import { isEqual } from 'lodash';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { type DataQuery } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Portal, Stack } from '@grafana/ui';

import { getCoauthoringSurface, isQueryCoauthoringV2Active, requestCoauthoringEntry } from './queryCoauthoringApi';
import {
  isQueryCoauthoringEditorHandle,
  type QueryCoauthoringEditorHandle,
  type QueryCoauthoringEditorHost,
  type QueryCoauthoringEditorSelection,
} from './queryCoauthoringContracts';
import { isQueryBroken } from './queryCoauthoringHealth';
import { useCoauthoringSurface } from './useCoauthoringSurface';

export function useCoauthoringEditor(query: DataQuery | null, queries: DataQuery[]) {
  const surface = useCoauthoringSurface();
  const active = isQueryCoauthoringV2Active();
  const [handle, setHandle] = useState<QueryCoauthoringEditorHandle>();
  const [selection, setSelection] = useState<(QueryCoauthoringEditorSelection & { rect: DOMRect }) | null>(null);
  const registration = useRef<() => void>(() => {});
  const refId = query?.refId;
  const host = useMemo<QueryCoauthoringEditorHost>(
    () => ({
      version: 1,
      register(candidate) {
        if (!isQueryCoauthoringEditorHandle(candidate)) {
          return () => {};
        }
        registration.current();
        setHandle(candidate);
        const update = () => {
          const selected = candidate.getSelection();
          setSelection(selected ? { ...selected, rect: selected.anchor.getBoundingClientRect() } : null);
        };
        const unsubscribe = candidate.subscribe(update);
        update();
        let registered = true;
        const stop = () => {
          if (!registered) {
            return;
          }
          registered = false;
          unsubscribe();
          candidate.showChanges?.(null);
          setHandle((current) => (current === candidate ? undefined : current));
          setSelection(null);
        };
        registration.current = stop;
        return stop;
      },
      invoke() {
        const current = getCoauthoringSurface();
        if (!current || !refId) {
          return;
        }
        const selected = handleRef.current?.getSelection();
        requestCoauthoringEntry(
          {
            target: { ...current.target, refId },
            ranges: selected?.ranges ?? [],
            intent: 'explain_or_modify',
            health: current.pane.getCoauthoringHealth(),
          },
          'highlight'
        );
      },
    }),
    [refId]
  );
  const handleRef = useRef(handle);
  useLayoutEffect(() => {
    handleRef.current = handle;
  }, [handle]);
  useEffect(() => {
    if (!active) {
      registration.current();
    }
    return () => registration.current();
  }, [active, host]);
  const preview = active ? surface?.pane.getCoauthoringEditorQueries() : undefined;
  const editorQuery = preview?.find((candidate) => candidate.refId === refId) ?? query;
  const option = surface?.state?.proposal?.find((option) => option.id === surface.state?.previewedOption);
  const diff = active ? option?.diffs.find((diff) => diff.refId === refId) : undefined;
  const lastMarks = useRef<{ handle?: QueryCoauthoringEditorHandle; diff: typeof diff } | undefined>(undefined);
  useEffect(() => {
    if (lastMarks.current?.handle !== handle || !isEqual(lastMarks.current?.diff, diff)) {
      handle?.showChanges?.(
        diff
          ? [
              {
                original: diff.original,
                proposed: diff.proposed,
                originalRanges: diff.originalRanges,
                proposedRanges: diff.proposedRanges,
              },
            ]
          : null
      );
      lastMarks.current = { handle, diff };
    }
  }, [handle, diff]);
  const request = (intent: 'explain_or_modify' | 'debug') => {
    if (!surface || !refId) {
      return;
    }
    requestCoauthoringEntry(
      {
        target: { ...surface.target, refId },
        ranges: selection?.ranges ?? [],
        intent,
        health: surface.pane.getCoauthoringHealth(),
      },
      intent === 'debug' ? 'debug' : 'highlight'
    );
  };
  const anchor = selection?.anchor;
  const rect = selection?.rect;
  useEffect(() => {
    if (!anchor) {
      return;
    }
    const update = () =>
      setSelection((current) => (current ? { ...current, rect: anchor.getBoundingClientRect() } : null));
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchor]);
  const broken = refId && surface && isQueryBroken(refId, queries, surface.pane.getCoauthoringHealth());
  const supported = refId && surface?.supported.has(refId);
  const toolbar =
    active && supported && rect && selection?.ranges.some((range) => range.to > range.from) ? (
      <Portal>
        <div
          role="toolbar"
          aria-label={t('query-coauthoring-v2.highlight-actions', 'Query selection actions')}
          style={{ position: 'fixed', left: rect.left, top: rect.bottom, zIndex: 1500 }}
          onMouseDown={(event) => event.preventDefault()}
        >
          <Stack>
            <Button size="sm" onClick={() => request('explain_or_modify')}>
              {t('query-coauthoring-v2.explain-modify', 'Explain or modify')}
            </Button>
            {broken && (
              <Button size="sm" onClick={() => request('debug')}>
                {t('query-coauthoring-v2.debug', 'Debug query')}
              </Button>
            )}
          </Stack>
        </div>
      </Portal>
    ) : null;
  return { active, host: active ? host : undefined, editorQuery, editorQueries: preview ?? queries, toolbar };
}
