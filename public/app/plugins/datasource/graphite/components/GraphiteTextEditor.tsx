import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { QueryInput } from '@grafana/ui';

import { actions } from '../state/actions';
import { useDispatch } from '../state/context';

type Props = {
  rawQuery: string;
};

export function GraphiteTextEditor({ rawQuery }: Props) {
  const dispatch = useDispatch();

  // The last value we propagated upstream, used to tell our own change echoing
  // back through `rawQuery` apart from a genuinely external replacement.
  const lastPropagatedRef = useRef(rawQuery);

  // Debounce change propagation for perf, like the Slate query field did:
  // every update re-parses the query model.
  const updateQuery = useMemo(
    () =>
      debounce((query: string) => {
        lastPropagatedRef.current = query;
        dispatch(actions.updateQuery({ query }));
      }, 500),
    [dispatch]
  );

  // When `rawQuery` is replaced from outside (e.g. query history) while an edit
  // is still debouncing, drop the pending edit so a stale keystroke can't
  // overwrite the new value.
  useEffect(() => {
    if (rawQuery === lastPropagatedRef.current) {
      return;
    }
    lastPropagatedRef.current = rawQuery;
    updateQuery.cancel();
  }, [rawQuery, updateQuery]);

  // Drop any pending edit on unmount. User-driven unmounts (e.g. clicking the
  // editor-mode toggle) blur the editor first, which flushes the edit — so a
  // pending edit here means the unmount was externally driven, and flushing
  // would overwrite the external change with a stale keystroke.
  useEffect(() => () => updateQuery.cancel(), [updateQuery]);

  const runQuery = useCallback(() => {
    // Push any pending edit into the state first so the executed query matches
    // what was typed.
    updateQuery.flush();
    dispatch(actions.runQuery());
  }, [updateQuery, dispatch]);

  return (
    <QueryInput
      value={rawQuery}
      onChange={updateQuery}
      aria-label="Graphite query"
      placeholder="Enter a Graphite query (run with Shift+Enter)"
      onRunQuery={runQuery}
      onBlur={runQuery}
    />
  );
}
