import { useCallback, useEffect, useState } from 'react';
import { useAsync } from 'react-use';
import { Subscription } from 'rxjs';

import { llms } from '@grafana/experimental';
import { createMonitoringLogger } from '@grafana/runtime';
import { useAppNotification } from 'app/core/copy/appNotification';

import { isLLMPluginEnabled, DEFAULT_OAI_MODEL } from './utils';

// Declared instead of imported from utils to make this hook modular
// Ideally we will want to move the hook itself to a different scope later.
type Message = llms.openai.Message;

const genAILogger = createMonitoringLogger('features.dashboards.genai');

export enum StreamStatus {
  IDLE = 'idle',
  GENERATING = 'generating',
  COMPLETED = 'completed',
}

export const TIMEOUT = 10000;

// TODO: Add tests
export function useOpenAIStream(
  model = DEFAULT_OAI_MODEL,
  temperature = 1
): {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setStopGeneration: React.Dispatch<React.SetStateAction<boolean>>;
  messages: Message[];
  reply: string;
  streamStatus: StreamStatus;
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
  const [stopGeneration, setStopGeneration] = useState(false);
  // The latest reply from the LLM.
  const [reply, setReply] = useState('');
  const [streamStatus, setStreamStatus] = useState<StreamStatus>(StreamStatus.IDLE);
  const [error, setError] = useState<Error>();
  const { error: notifyError } = useAppNotification();
  // Accumulate response and it will only update the state of the attatched component when the stream is completed.
  let partialReply = '';

  const onError = useCallback(
    (e: Error) => {
      setStreamStatus(StreamStatus.IDLE);
      setMessages([]);
      setStopGeneration(false);
      setError(e);
      notifyError(
        'Failed to generate content using OpenAI',
        `Please try again or if the problem persists, contact your organization admin.`
      );
      console.error(e);
      genAILogger.logError(e, { messages: JSON.stringify(messages), model, temperature: String(temperature) });
    },
    [messages, model, temperature, notifyError]
  );

  useEffect(() => {
    if (messages.length > 0) {
      setReply('');
    }
  }, [messages]);

  const { error: enabledError, value: enabled } = useAsync(
    async () => await isLLMPluginEnabled(),
    [isLLMPluginEnabled]
  );

  const { error: asyncError, value } = useAsync(async () => {
    if (!enabled || !messages.length) {
      return { enabled };
    }

    setStreamStatus(StreamStatus.GENERATING);
    setError(undefined);
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
        llms.openai.accumulateContent()
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
        next: (reply) => {
          partialReply = reply;
        },
        error: onError,
        complete: () => {
          setReply(partialReply);
          setStreamStatus(StreamStatus.COMPLETED);
          setTimeout(() => {
            setStreamStatus(StreamStatus.IDLE);
          });
          setMessages([]);
          setStopGeneration(false);
          setError(undefined);
        },
      }),
    };
  }, [messages, enabled]);

  // Unsubscribe from the stream when the component unmounts.
  useEffect(() => {
    return () => {
      if (value?.stream) {
        value.stream.unsubscribe();
      }
    };
  }, [value]);

  // Unsubscribe from the stream when user stops the generation.
  useEffect(() => {
    if (stopGeneration) {
      value?.stream?.unsubscribe();
      setStreamStatus(StreamStatus.IDLE);
      setStopGeneration(false);
      setError(undefined);
      setMessages([]);
    }
  }, [stopGeneration, value?.stream]);

  // If the stream is generating and we haven't received a reply, it times out.
  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined;
    if (streamStatus === StreamStatus.GENERATING && reply === '') {
      timeout = setTimeout(() => {
        onError(new Error(`OpenAI stream timed out after ${TIMEOUT}ms`));
      }, TIMEOUT);
    }
    return () => {
      timeout && clearTimeout(timeout);
    };
  }, [streamStatus, reply, onError]);

  if (asyncError || enabledError) {
    setError(asyncError || enabledError);
  }

  return {
    setMessages,
    setStopGeneration,
    messages,
    reply,
    streamStatus,
    error,
    value,
  };
}
