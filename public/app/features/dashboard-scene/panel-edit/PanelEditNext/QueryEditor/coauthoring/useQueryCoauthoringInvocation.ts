import { useCallback, useEffect, useRef, useState } from 'react';

import { type DataQuery } from '@grafana/schema';

import {
  type QueryEditorCoauthoringAdapterV1,
  type QueryEditorCoauthoringContextV1,
} from './internalCoauthoringContract';

interface QueryCoauthoringInvocationOptions {
  adapter: QueryEditorCoauthoringAdapterV1;
  invocationId: string;
  isAssistantAvailable: boolean;
  onBaseline: (query: DataQuery) => boolean;
}

class StaleQueryCoauthoringInvocationError extends Error {}

export function useQueryCoauthoringInvocation({
  adapter,
  invocationId,
  isAssistantAvailable,
  onBaseline,
}: QueryCoauthoringInvocationOptions) {
  const [context, setContext] = useState<QueryEditorCoauthoringContextV1>();
  const [contextError, setContextError] = useState(false);
  const contextPromiseRef = useRef<Promise<QueryEditorCoauthoringContextV1> | undefined>(undefined);
  const invocationEpochRef = useRef(0);
  const baselineRef = useRef<DataQuery | undefined>(undefined);
  const onBaselineRef = useRef(onBaseline);
  onBaselineRef.current = onBaseline;

  const loadContext = useCallback(() => {
    setContext(undefined);
    setContextError(false);
    const invocationEpoch = ++invocationEpochRef.current;
    const contextPromise = adapter.readInvocation(invocationId).then(({ baseline, context }) => {
      if (invocationEpoch !== invocationEpochRef.current) {
        throw new StaleQueryCoauthoringInvocationError();
      }
      if (context.revision !== invocationId) {
        throw new Error('The query coauthoring invocation revision does not match the requested invocation.');
      }
      if (!onBaselineRef.current(baseline)) {
        throw new Error('The query coauthoring baseline is no longer current.');
      }
      baselineRef.current = baseline;
      return context;
    });
    contextPromiseRef.current = contextPromise;
    void contextPromise.then(
      (nextContext) => {
        if (contextPromiseRef.current === contextPromise) {
          setContext(nextContext);
        }
      },
      () => {
        if (contextPromiseRef.current === contextPromise && invocationEpoch === invocationEpochRef.current) {
          setContextError(true);
        }
      }
    );
  }, [adapter, invocationId]);

  const readContext = useCallback(async () => {
    const invocationEpoch = invocationEpochRef.current;
    try {
      if (context) {
        return context;
      }
      if (contextPromiseRef.current) {
        return await contextPromiseRef.current;
      }
      const invocation = await adapter.readInvocation(invocationId);
      if (invocationEpoch !== invocationEpochRef.current) {
        throw new StaleQueryCoauthoringInvocationError();
      }
      if (invocation.context.revision !== invocationId) {
        throw new Error('The query coauthoring invocation revision does not match the requested invocation.');
      }
      if (!onBaselineRef.current(invocation.baseline)) {
        throw new Error('The query coauthoring baseline is no longer current.');
      }
      baselineRef.current = invocation.baseline;
      return invocation.context;
    } catch (error) {
      if (!(error instanceof StaleQueryCoauthoringInvocationError)) {
        setContextError(true);
      }
      throw error;
    }
  }, [adapter, context, invocationId]);

  const clear = useCallback(() => {
    invocationEpochRef.current++;
    setContext(undefined);
    setContextError(false);
    contextPromiseRef.current = undefined;
    baselineRef.current = undefined;
  }, []);

  useEffect(() => {
    if (!isAssistantAvailable) {
      return;
    }

    const invocationEpoch = invocationEpochRef;
    loadContext();
    return () => {
      invocationEpoch.current++;
      contextPromiseRef.current = undefined;
    };
  }, [isAssistantAvailable, loadContext]);

  return {
    clear,
    context,
    contextError,
    loadContext,
    readContext,
    readBaseline: () => baselineRef.current,
  };
}
