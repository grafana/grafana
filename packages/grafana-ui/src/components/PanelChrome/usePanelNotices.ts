import { useEffect, useRef, useSyncExternalStore } from 'react';

import type {
  PanelNotice,
  PanelStatusActionResolver,
  PanelNoticeSource,
  PanelNotices,
  PanelStatusSnapshot,
} from '@grafana/data';

import { usePanelContext } from './PanelContext';

const empty: PanelStatusSnapshot = { generation: 0, items: [], actions: {} };
const getEmpty = () => empty;
const subscribeEmpty = () => () => {};

/** Subscribe to all panel status items, including action execution state. @alpha */
export function usePanelStatusSnapshot(controller?: PanelNotices) {
  return useSyncExternalStore(controller?.subscribe ?? subscribeEmpty, controller?.getSnapshot ?? getEmpty, getEmpty);
}

/** Publishes notices and optional action contributions for this component's lifetime. @alpha */
export function usePanelNotices(items: readonly PanelNotice[], resolver?: PanelStatusActionResolver) {
  const { notices } = usePanelContext();
  const generation = useSyncExternalStore(
    notices?.subscribe ?? subscribeEmpty,
    () => notices?.getSnapshot().generation ?? 0,
    () => 0
  );
  const source = useRef<PanelNoticeSource | undefined>(undefined);
  useEffect(() => {
    source.current = notices?.createSource();
    return () => {
      source.current?.dispose();
      source.current = undefined;
    };
  }, [notices, generation]);
  useEffect(() => {
    source.current?.set(items);
  }, [notices, generation, items]);
  useEffect(() => {
    source.current?.setActionResolver(resolver);
  }, [notices, generation, resolver]);
  return Boolean(notices);
}
