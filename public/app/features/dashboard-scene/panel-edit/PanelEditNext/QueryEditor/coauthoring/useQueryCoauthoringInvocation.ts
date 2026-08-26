import { useCallback, useEffect, useRef, useState } from 'react';

import { useInlineAssistant } from '@grafana/assistant';
import { type DataQuery } from '@grafana/schema';

import {
  type QueryEditorCoauthoringAdapterV1,
  type QueryEditorCoauthoringContextV1,
} from './internalCoauthoringContract';
import {
  buildIdentificationPrompt,
  buildIdentificationSystemPrompt,
  normalizeSelectionExplanation,
  selectionSummary,
} from './queryCoauthoringPrompts';

interface QueryCoauthoringInvocationOptions {
  adapter: QueryEditorCoauthoringAdapterV1;
  invocationId: string;
  isAssistantAvailable: boolean;
  datasourceType: string;
  timeRange?: { from: number; to: number };
  onBaseline: (query: DataQuery) => boolean;
}

export function useQueryCoauthoringInvocation({
  adapter,
  invocationId,
  isAssistantAvailable,
  datasourceType,
  timeRange,
  onBaseline,
}: QueryCoauthoringInvocationOptions) {
  const {
    generate: identifySelection,
    isGenerating: isIdentifying,
    cancel: cancelAssistantIdentification,
    reset: resetIdentification,
  } = useInlineAssistant();
  const [context, setContext] = useState<QueryEditorCoauthoringContextV1>();
  const [contextError, setContextError] = useState(false);
  const [selectionExplanation, setSelectionExplanation] = useState<string>();
  const contextPromiseRef = useRef<Promise<QueryEditorCoauthoringContextV1> | undefined>(undefined);
  const identificationIdRef = useRef(0);
  const onBaselineRef = useRef(onBaseline);
  const identifySelectionRef = useRef(identifySelection);
  const cancelIdentificationRef = useRef(cancelAssistantIdentification);
  const datasourceTypeRef = useRef(datasourceType);
  const timeRangeRef = useRef(timeRange);
  onBaselineRef.current = onBaseline;
  identifySelectionRef.current = identifySelection;
  cancelIdentificationRef.current = cancelAssistantIdentification;
  datasourceTypeRef.current = datasourceType;
  timeRangeRef.current = timeRange;

  const loadContext = useCallback(() => {
    setContext(undefined);
    setContextError(false);
    const contextPromise = adapter.readInvocation(invocationId).then(({ baseline, context }) => {
      if (!onBaselineRef.current(baseline)) {
        throw new Error('The query coauthoring baseline is no longer current.');
      }
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
        if (contextPromiseRef.current === contextPromise) {
          setContextError(true);
        }
      }
    );
  }, [adapter, invocationId]);

  const readContext = useCallback(async () => {
    try {
      if (context) {
        return context;
      }
      if (contextPromiseRef.current) {
        return await contextPromiseRef.current;
      }
      const invocation = await adapter.readInvocation(invocationId);
      if (!onBaselineRef.current(invocation.baseline)) {
        throw new Error('The query coauthoring baseline is no longer current.');
      }
      return invocation.context;
    } catch (error) {
      setContextError(true);
      throw error;
    }
  }, [adapter, context, invocationId]);

  const cancelIdentification = useCallback(() => {
    identificationIdRef.current++;
    cancelAssistantIdentification();
  }, [cancelAssistantIdentification]);

  const clear = useCallback(() => {
    identificationIdRef.current++;
    cancelAssistantIdentification();
    resetIdentification();
    setContext(undefined);
    setContextError(false);
    setSelectionExplanation(undefined);
    contextPromiseRef.current = undefined;
  }, [cancelAssistantIdentification, resetIdentification]);

  useEffect(() => {
    if (!context || !isAssistantAvailable) {
      return;
    }

    const identificationState = identificationIdRef;
    const identificationId = ++identificationState.current;
    const fallbackExplanation = selectionSummary(context);
    const identificationDatasourceType = datasourceTypeRef.current;
    const identificationTimeRange = timeRangeRef.current;
    setSelectionExplanation(undefined);
    void identifySelectionRef.current({
      origin: 'grafana/panel-edit-next/query-coauthoring/identify',
      agentName: 'query-coauthor-intent',
      agentId: 'grafana.query.coauthor.identify.v1',
      prompt: buildIdentificationPrompt(context),
      systemPrompt: buildIdentificationSystemPrompt(
        context,
        identificationDatasourceType,
        identificationTimeRange ? { from: identificationTimeRange.from, to: identificationTimeRange.to } : undefined
      ),
      onComplete: (completionText) => {
        if (identificationId === identificationIdRef.current) {
          setSelectionExplanation(normalizeSelectionExplanation(completionText, fallbackExplanation));
        }
      },
      onError: () => {
        if (identificationId === identificationIdRef.current) {
          setSelectionExplanation(fallbackExplanation);
        }
      },
    });

    return () => {
      identificationState.current++;
      cancelIdentificationRef.current();
    };
  }, [context, isAssistantAvailable]);

  useEffect(() => {
    if (!isAssistantAvailable) {
      return;
    }

    const identificationState = identificationIdRef;
    loadContext();
    return () => {
      identificationState.current++;
      cancelAssistantIdentification();
    };
  }, [cancelAssistantIdentification, isAssistantAvailable, loadContext]);

  return {
    cancelIdentification,
    clear,
    context,
    contextError,
    isIdentifying,
    loadContext,
    readContext,
    selectionExplanation,
  };
}
