
import html2canvas from 'html2canvas';
import { useCallback, useEffect, useState } from 'react';

import { openai } from '@grafana/llm';
import { Button } from '@grafana/ui';

export const Hoverbot = () => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [reply, setReply] = useState('');

  useEffect(() => {
    openai.enabled().then(setEnabled);
  }, []);

  const ask = useCallback((image: string) => {
    // Stream the completions. Each element is the next stream chunk.
    const stream = openai
      .streamChatCompletions({
        model: openai.Model.LARGE,
        messages: [
          { role: 'system', content: 'You are helping an observability user understand the data they are seeing.' },
          // @ts-expect-error
          { role: 'user', content: [
            {
              "type": "text",
              "text": scrapContext(),
            },
            {
              "type": "image_url",
              "image_url": {
                "url": image
              }
            }
          ]
        }],
      })
      .pipe(
        openai.accumulateContent(),
      );
    // Subscribe to the stream and update the state for each returned value.
    stream.subscribe({
      next: setReply,
      complete: () => {
        setLoading(false);
      },
      error: (e) => {
        console.error(e);
        setLoading(false);
      }
    });
  }, [])

  const helpMe = useCallback((element: HTMLDivElement) => {
    if (!enabled) {
      console.error('LLM Disabled');
      return;
    }

    setLoading(true);

    html2canvas(element, { allowTaint: true }).then((canvas) => {
      ask(canvas.toDataURL('image/png', 0.5));
    });
  }, [ask, enabled]);

  const handleClick = useCallback(() => {
    if (!highlighted) {
      return;
    }
    document.removeEventListener('mouseover', handleMouseOver);
    document.removeEventListener('click', handleClick);
    if (highlighted) {
      highlighted.style.outline = '';
      highlighted.style.boxShadow = '';
      helpMe(highlighted);
      highlighted = undefined;
    }
    setSelecting(false);
  }, [helpMe]);

  const selectRegion = useCallback(() => {
    setSelecting(true);
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('click', handleClick);
  }, [handleClick]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        document.removeEventListener('mouseover', handleMouseOver);
        document.removeEventListener('click', handleClick);
        setSelecting(false);
        if (highlighted) {
          highlighted.style.outline = '';
          highlighted.style.boxShadow = '';
          highlighted = undefined;
        }
      }
    }

    document.addEventListener('keyup', handleEscape);
    return () => document.removeEventListener('keyup', handleEscape);
  }, [handleClick]);

  return (
    <div>
      <Button type="submit" onClick={selectRegion} disabled={loading || selecting || !enabled}>
        Help me
      </Button>
      {reply !== '' && (
        <p>{reply}</p>
      )}
    </div>
  );
}

let highlighted: HTMLDivElement | undefined;

function handleMouseOver(e: MouseEvent) {
  if (e.target instanceof HTMLDivElement) {
    const target = getEventTarget(e.target);
    if (!target) {
      return;
    }
    target.style.outline = 'solid 1px orange';
    target.style.boxShadow = '0 0 10px 5px rgba(255, 0, 0, 0.5)'
    if (highlighted) {
      highlighted.style.outline = '';
      highlighted.style.boxShadow = '';
    }
    highlighted = target;
  }
}

function getEventTarget(element: HTMLDivElement, bubbled = 2) {
  const rect = element.getBoundingClientRect();
  if (rect.height < 39 || rect.width < 39) {
    if ((bubbled-1) >= 0 && element.parentElement instanceof HTMLDivElement) {
      return getEventTarget(element.parentElement, bubbled-1);
    }
    return;
  }
  return element;
}

function scrapContext(): string {
  if (document.title.includes('Explore')) {
    return scrapExploreContext();
  }

  return 'Help me understand the following observability data from logs:';
}

function scrapExploreContext() {
  let context = "I'm in Grafana Explore. ";

  context += `${getTimeRangeContext()}. `;
  
  const queries: string[] = [];
  document.querySelectorAll('[data-testid="data-testid Query field"]').forEach((queryField) => {
    let query = '';
    queryField.querySelectorAll('.view-line span > span').forEach((span) => {
        query += span.innerHTML;
    });
    if (query) {
      queries.push(query.replaceAll('&nbsp;', ' '));
    }
  });

  context += `I'm running the following ${queries.length === 1 ? 'query' : 'queries'}:`;

  queries.forEach(query => {
    context+= "\n\n````\n"+query+"\n```\n\n";
  });

  context += "Please help me interpret the following image from Grafana.";

  console.log(context);

  return context;
}

function getTimeRangeContext() {
  const picker = document.querySelector('[data-testid="data-testid TimePicker Open Button"]')
  return picker?.getAttribute('aria-label') ?? '';
}
