
import { useCallback, useEffect, useState } from 'react';

import { openai } from '@grafana/llm';
import { Button } from '@grafana/ui';

export const Hoverbot = () => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState('');

  useEffect(() => {
    openai.enabled().then(setEnabled);
  }, []);

  const helpMe = useCallback(() => {
    if (!enabled) {
      console.error('LLM Disabled');
      return false;
    }

    setLoading(true);

    // Stream the completions. Each element is the next stream chunk.
    const stream = openai
      .streamChatCompletions({
        model: openai.Model.LARGE,
        messages: [
          { role: 'system', content: 'You are helping an observability user understand the data they are seeing.' },
          { role: 'user', content: 'test' },
        ],
      })
      .pipe(
        openai.accumulateContent(),
      );
    // Subscribe to the stream and update the state for each returned value.
    return stream.subscribe(setReply);
  }, [enabled]);

  return (
    <div>
      <Button type="submit" onClick={helpMe} disabled={loading}>
        Help me
      </Button>
      {reply !== '' && (
        <p>{reply}</p>
      )}
    </div>
  );
}
