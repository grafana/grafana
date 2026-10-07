import { useEffect, useRef, useSyncExternalStore } from 'react';

import type {
  PanelDiagnostic,
  PanelDiagnosticActionResolver,
  PanelDiagnosticSource,
  PanelDiagnostics,
  PanelDiagnosticsSnapshot,
} from '@grafana/data';

import { usePanelContext } from './PanelContext';

const empty: PanelDiagnosticsSnapshot = { generation: 0, items: [], actions: {} };
const getEmpty = () => empty;
const subscribeEmpty = () => () => {};

/** Subscribe to a panel's diagnostics, including action execution state. @alpha */
export function usePanelDiagnosticsSnapshot(controller?: PanelDiagnostics) {
  return useSyncExternalStore(controller?.subscribe ?? subscribeEmpty, controller?.getSnapshot ?? getEmpty, getEmpty);
}

/** Publishes diagnostics and optional action contributions for this component's lifetime. @alpha */
export function usePanelDiagnostics(items: readonly PanelDiagnostic[], resolver?: PanelDiagnosticActionResolver) {
  const { diagnostics } = usePanelContext();
  const generation = useSyncExternalStore(
    diagnostics?.subscribe ?? subscribeEmpty,
    () => diagnostics?.getSnapshot().generation ?? 0,
    () => 0
  );
  const source = useRef<PanelDiagnosticSource | undefined>(undefined);
  useEffect(() => {
    source.current = diagnostics?.createSource();
    return () => {
      source.current?.dispose();
      source.current = undefined;
    };
  }, [diagnostics, generation]);
  useEffect(() => {
    source.current?.set(items);
  }, [diagnostics, generation, items]);
  useEffect(() => {
    source.current?.setActionResolver(resolver);
  }, [diagnostics, generation, resolver]);
  return Boolean(diagnostics);
}
