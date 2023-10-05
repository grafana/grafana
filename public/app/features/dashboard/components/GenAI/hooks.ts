import { useState } from 'react';
import { useAsync } from 'react-use';
import { Subscription } from 'rxjs';

import { logError } from '@grafana/runtime';
import { useAppNotification } from 'app/core/copy/appNotification';

import { openai } from './llms';
import { isLLMPluginEnabled, OPEN_AI_MODEL } from './utils';

// Declared instead of imported from utils to make this hook modular
// Ideally we will want to move the hook itself to a different scope later.
type Message = openai.Message;

// TODO: Add tests
export function useOpenAIStream(
  model = OPEN_AI_MODEL,
  temperature = 1
): {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  reply: string;
  isGenerating: boolean;
  error: Error | undefined;
  value:
    | {
        enabled: boolean | undefined;
        stream?: undefined;
      }
    | {
        enabled: boolean | undefined;
        stream: Subscription;
      }
    | undefined;
} {
  // The messages array to send to the LLM, updated when the button is clicked.
  const [messages, setMessages] = useState<Message[]>([]);
  // The latest reply from the LLM.
  const [reply, setReply] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error>();
  const { error: notifyError } = useAppNotification();

  const { error: enabledError, value: enabled } = useAsync(
    async () => await isLLMPluginEnabled(),
    [isLLMPluginEnabled]
  );

  const { error: asyncError, value } = useAsync(async () => {
    if (!enabled || !messages.length) {
      return { enabled };
    }

    setIsGenerating(true);
    setError(undefined);
    // Stream the completions. Each element is the next stream chunk.
    const stream = openai
      .streamChatCompletions({
        model,
        temperature,
        messages,
      })
      .pipe(
        // Accumulate the stream content into a stream of strings, where each
        // element contains the accumulated message so far.
        openai.accumulateContent()
        // The stream is just a regular Observable, so we can use standard rxjs
        // functionality to update state, e.g. recording when the stream
        // has completed.
        // The operator decision tree on the rxjs website is a useful resource:
        // https://rxjs.dev/operator-decision-tree.)
      );
    // Subscribe to the stream and update the state for each returned value.
    return {
      enabled,
      stream: stream.subscribe({
        next: setReply,
        error: (e: Error) => {
          setIsGenerating(false);
          setMessages([]);
          setError(e);
          notifyError('OpenAI Error', `${e.message}`);
          logError(e, { messages: JSON.stringify(messages), model, temperature: String(temperature) });
        },
        complete: () => {
          setIsGenerating(false);
          setMessages([]);
          setError(undefined);
        },
      }),
    };
  }, [messages, enabled]);

  if (asyncError || enabledError) {
    setError(asyncError || enabledError);
  }

  return {
    setMessages,
    reply,
    isGenerating,
    error,
    value,
  };
}
