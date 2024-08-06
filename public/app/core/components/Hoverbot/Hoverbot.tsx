
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
              "text": "Help me understand the following observability data from logs:"
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

    html2canvas(element).then((canvas) => {
      ask(canvas.toDataURL());
    });
  }, [ask, enabled]);

  const selectRegion = useCallback(() => {
    setSelecting(true);
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('click', handleClick);

    function handleClick() {
      if (!highlighted) {
        return;
      }
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('click', handleClick);
      if (highlighted) {
        highlighted.style.outline = '';
        helpMe(highlighted);
        highlighted = undefined;
      }
      setSelecting(false);
    }
  }, [helpMe]);

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
    const rect = e.target.getBoundingClientRect();
    if (rect.height < 50 || rect.width < 50) {
      return;
    }
    e.target.style.outline = 'solid 1px red';
    if (highlighted) {
      highlighted.style.outline = '';
    }
    highlighted = e.target;
  }
}
