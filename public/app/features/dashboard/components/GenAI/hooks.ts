import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react';
import { useAsync } from 'react-use';
import { Subscription } from 'rxjs';

import { llm } from '@grafana/llm';
import { createMonitoringLogger } from '@grafana/runtime';
import { useAppNotification } from 'app/core/copy/appNotification';

import { DEFAULT_LLM_MODEL, isLLMPluginEnabled } from './utils';

// Declared instead of imported from utils to make this hook modular
// Ideally we will want to move the hook itself to a different scope later.
type Message = llm.Message;

const genAILogger = createMonitoringLogger('features.dashboards.genai');

export enum StreamStatus {
  IDLE = 'idle',
  GENERATING = 'generating',
  COMPLETED = 'completed',
}

export const TIMEOUT = 10000; // 10 seconds

interface Options {
  model: string;
  temperature: number;
  onResponse?: (response: string) => void;
  timeout?: number;
}

const defaultOptions = {
  model: DEFAULT_LLM_MODEL,
  temperature: 1,
  timeout: TIMEOUT,
};

interface UseLLMStreamResponse {
  setMessages: Dispatch<SetStateAction<Message[]>>;
  stopGeneration: () => void;
  messages: Message[];
  reply: string;
  streamStatus: StreamStatus;
  error?: Error;
  value?: {
    enabled?: boolean | undefined;
    stream?: Subscription;
  };
}

// TODO: Add tests
export function useLLMStream(options: Options = defaultOptions): UseLLMStreamResponse {
  const { model, temperature, onResponse, timeout } = { ...defaultOptions, ...options };
  // The messages array to send to the LLM, updated when the button is clicked.
  const [messages, setMessages] = useState<Message[]>([]);

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
      setError(e);
      notifyError(
        'Failed to generate content using LLM',
        'Please try again or if the problem persists, contact your organization admin.'
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
    const stream = llm
      .streamChatCompletions({
        model,
        temperature,
        messages,
      })
      .pipe(
        // Accumulate the stream content into a stream of strings, where each
        // element contains the accumulated message so far.
        llm.accumulateContent()
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
          onResponse?.(partialReply);
          setMessages([]);
          setError(undefined);
        },
      }),
    };
  }, [messages, enabled]);

  // Unsubscribe from the stream when the component unmounts.
  useEffect(() => {
    return () => {
      value?.stream?.unsubscribe();
    };
  }, [value]);

  // Unsubscribe from the stream when user stops the generation.
  const stopGeneration = useCallback(() => {
    value?.stream?.unsubscribe();
    setStreamStatus(StreamStatus.IDLE);
    setError(undefined);
    setMessages([]);
  }, [value]);

  // If the stream is generating and we haven't received a reply, it times out.
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined;
    if (streamStatus === StreamStatus.GENERATING && reply === '') {
      timeoutId = setTimeout(() => {
        onError(new Error(`LLM stream timed out after ${timeout}ms`));
      }, timeout);
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [streamStatus, reply, onError, timeout]);

  if (asyncError || enabledError) {
    setError(asyncError || enabledError);
  }

  return {
    setMessages,
    stopGeneration,
    messages,
    reply,
    streamStatus,
    error,
    value,
  };
}
