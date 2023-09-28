import { useState } from 'react';
import { useAsync } from 'react-use';
import { Subscription } from 'rxjs';

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
        enabled: boolean;
        stream?: undefined;
      }
    | {
        enabled: boolean;
        stream: Subscription;
      }
    | undefined;
} {
  // The messages array to send to the LLM, updated when the button is clicked.
  const [messages, setMessages] = useState<Message[]>([]);
  // The latest reply from the LLM.
  const [reply, setReply] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);

  const { error, value } = useAsync(async () => {
    // Check if the LLM plugin is enabled and configured.
    // If not, we won't be able to make requests, so return early.
    const enabled = await isLLMPluginEnabled();
    if (!enabled) {
      return { enabled };
    }
    if (messages.length === 0) {
      return { enabled };
    }

    setIsGenerating(true);
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
        // https://rxjs.dev/operator-decision-tree.
      );
    // Subscribe to the stream and update the state for each returned value.
    return {
      enabled,
      stream: stream.subscribe({
        next: setReply,
        error: (e) => {
          console.log('The backend for the stream returned an error and nobody has implemented error handling yet!');
          console.log(e);
        },
        complete: () => {
          setIsGenerating(false);
          setMessages([]);
        },
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
    isGenerating,
    error,
    value,
  };
}
