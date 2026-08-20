import { Component, type ReactNode, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import {
  type QueryEditorCoauthoringCapability,
  type QueryEditorCoauthoringContext,
  type QueryEditorCoauthoringInvocation,
  type QueryEditorCoauthoringPreview,
  type QueryEditorCoauthoringContextV1,
  type QueryEditorCoauthoringControllerV1,
  type QueryEditorCoauthoringV1Props,
} from '@grafana/data';
import { Button, ClipboardButton, Stack } from '@grafana/ui';

import { useQueryCoauthoringHost } from './QueryCoauthoringHostContext';
import { QueryCoauthoring } from './QueryCoauthoring';

export function QueryCoauthoringExposedComponent(props: QueryEditorCoauthoringV1Props) {
  const host = useQueryCoauthoringHost();
  const disposedControllers = useRef(new WeakSet<QueryEditorCoauthoringControllerV1>());
  const failedControllers = useRef(new WeakSet<QueryEditorCoauthoringControllerV1>());
  const { controller, initializationError } = useMemo(() => {
    try {
      return { controller: props.createController(), initializationError: undefined };
    } catch (error) {
      return { controller: undefined, initializationError: error };
    }
  }, [props.createController]);
  const dispose = useCallback((currentController: QueryEditorCoauthoringControllerV1) => {
    if (disposedControllers.current.has(currentController)) {
      return;
    }
    disposedControllers.current.add(currentController);
    currentController.dispose();
  }, []);
  const fail = useCallback(
    (currentController: QueryEditorCoauthoringControllerV1) => {
      failedControllers.current.add(currentController);
      try {
        currentController.clearEditorDiff();
      } finally {
        host.revert();
        dispose(currentController);
        props.onSurfaceStateChange({ generation: props.surfaceGeneration, state: 'failed' });
      }
    },
    [dispose, host, props]
  );

  useEffect(() => {
    if (!controller) {
      props.onSurfaceStateChange({ generation: props.surfaceGeneration, state: 'failed' });
      return;
    }
    if (failedControllers.current.has(controller)) {
      return;
    }
    props.onSurfaceStateChange({ generation: props.surfaceGeneration, state: 'ready' });
    return () => {
      dispose(controller);
      if (!failedControllers.current.has(controller)) {
        props.onSurfaceStateChange({ generation: props.surfaceGeneration, state: 'unavailable' });
      }
    };
  }, [controller, dispose, props.onSurfaceStateChange, props.surfaceGeneration]);

  if (!controller || initializationError) {
    return null;
  }

  return (
    <QueryCoauthoringFailureBoundary resetKey={controller} onFailure={() => fail(controller)}>
      <QueryCoauthoringSurface controller={controller} />
    </QueryCoauthoringFailureBoundary>
  );
}

class QueryCoauthoringFailureBoundary extends Component<
  { children: ReactNode; onFailure: () => void; resetKey: object },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure();
  }

  componentDidUpdate(previousProps: Readonly<{ resetKey: object }>) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function QueryCoauthoringSurface({ controller }: { controller: QueryEditorCoauthoringControllerV1 }) {
  const host = useQueryCoauthoringHost();
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const portalTarget = controller.getPortalTarget();
  const adapter = useMemo(() => createLegacyAdapter(controller), [controller]);

  const begin = useCallback(async () => {
    await adapter.begin();
  }, [adapter]);

  if (snapshot.mode === 'hidden') {
    return null;
  }

  return createPortal(
    <Stack direction="column" gap={1}>
      {snapshot.mode === 'selection' && (
        <Stack direction="row" gap={0.5}>
          <ClipboardButton getText={() => snapshot.selectedText} size="sm" variant="secondary">
            Copy
          </ClipboardButton>
          <Button size="sm" variant="secondary" icon="ai-sparkle" onClick={() => void begin()}>
            Coauthor
          </Button>
        </Stack>
      )}
      <QueryCoauthoring
        capability={adapter.capability}
        onAccept={(query) => host.accept(query, adapter.getBaselineRevision())}
        onPreview={(query) => host.preview(query, adapter.getBaselineRevision())}
        onRevertPreview={host.revert}
      />
    </Stack>,
    portalTarget
  );
}

function createLegacyAdapter(controller: QueryEditorCoauthoringControllerV1) {
  let context: QueryEditorCoauthoringContextV1 | undefined;
  let staged:
    | { source: string; result: Extract<ReturnType<typeof controller.stageEditorDiff>, { status: 'staged' }> }
    | undefined;
  const listeners = new Set<(invocation: QueryEditorCoauthoringInvocation) => void>();

  const loadContext = async (
    load: () => Promise<QueryEditorCoauthoringContextV1>
  ): Promise<QueryEditorCoauthoringContext> => {
    context = await load();
    return toLegacyContext(context);
  };

  const capability: QueryEditorCoauthoringCapability = {
    getValue: () => context?.query ?? '',
    getContext: () => (context ? Promise.resolve(toLegacyContext(context)) : loadContext(() => controller.begin())),
    refreshContext: () => loadContext(() => controller.refreshContext()),
    createQuery: (value: string) => {
      if (staged?.source === value) {
        return staged.result.query;
      }
      throw new Error('A query can only be created from a staged coauthoring proposal.');
    },
    validateQuery: () => true,
    stagePreview: (value: string): QueryEditorCoauthoringPreview | undefined => {
      const result = controller.stageEditorDiff(value);
      if (result.status !== 'staged') {
        staged = undefined;
        return undefined;
      }
      staged = { source: value, result };
      return { changes: result.changes };
    },
    clearPreview: () => {
      staged = undefined;
      controller.clearEditorDiff();
    },
    subscribeToInvocation: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    focus: () => controller.focus(),
  };

  return {
    capability,
    getBaselineRevision: () => staged?.result.baselineRevision ?? context?.revision ?? '',
    begin: async () => {
      context = await controller.begin();
      const invocation = { anchorElement: controller.getPortalTarget(), dismiss: () => controller.dismiss() };
      listeners.forEach((listener) => listener(invocation));
    },
  };
}

function toLegacyContext(context: QueryEditorCoauthoringContextV1): QueryEditorCoauthoringContext {
  return {
    query: context.query,
    focusRanges: context.focusRanges,
    metricMetadata: context.metricMetadata,
  };
}
