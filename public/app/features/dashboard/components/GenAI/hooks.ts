import { useState } from 'react';
import { useAsync } from 'react-use';
import { Subscription, finalize } from 'rxjs';

import { llms } from '@grafana/experimental';

// Declared instead of imported from utils to make this hook modular
// Ideally we will want to move the hook itself to a different scope later.
type Message = llms.openai.Message;

// TODO: Add tests
export function useOpenAIStream(
  model = 'gpt-3.5-turbo',
  temperature = 1
): {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  reply: string;
  started: boolean;
  finished: boolean;
  loading: boolean;
  error: Error | undefined;
  value:
    | {
        enabled: any;
        stream?: undefined;
      }
    | {
        enabled: any;
        stream: Subscription;
      }
    | undefined;
} {
  // The messages array to send to the LLM, updated when the button is clicked.
  const [messages, setMessages] = useState<Message[]>([]);
  // The latest reply from the LLM.
  const [reply, setReply] = useState('');

  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(true);

  const { loading, error, value } = useAsync(async () => {
    // Check if the LLM plugin is enabled and configured.
    // If not, we won't be able to make requests, so return early.
    const enabled = await llms.openai.enabled();
    if (!enabled) {
      return { enabled };
    }
    if (messages.length === 0) {
      return { enabled };
    }

    setStarted(true);
    setFinished(false);
    // Stream the completions. Each element is the next stream chunk.
    const stream = llms.openai
      .streamChatCompletions({
        model,
        temperature,
        messages,
      })
      .pipe(
        // Accumulate the stream content into a stream of strings, where each
        // element contains the accumulated message so far.
        llms.openai.accumulateContent(),
        // The stream is just a regular Observable, so we can use standard rxjs
        // functionality to update state, e.g. recording when the stream
        // has completed.
        // The operator decision tree on the rxjs website is a useful resource:
        // https://rxjs.dev/operator-decision-tree.

        // TODO: Investigate finalize being called multiple times during a stream (i.e. when generating panel description)
        finalize(() => {
          setStarted(false);
          setFinished(true);
          setMessages([]);
        })
      );
    // Subscribe to the stream and update the state for each returned value.
    return {
      enabled,
      stream: stream.subscribe({
        next: setReply,
      }),
    };
  }, [messages]);

  if (error) {
    // TODO: handle errors.
    console.log('An error occurred');
    console.log(error.message);
  }

  return {
    setMessages,
    reply,
    started,
    finished,
    loading,
    error,
    value,
  };
}
