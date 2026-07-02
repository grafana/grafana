import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { useTheme2 } from '@grafana/ui';
import { CodeMirrorEditor, getQueryFieldConfig } from '@grafana/ui/unstable';

import { actions } from '../state/actions';
import { useDispatch } from '../state/context';

type Props = {
  rawQuery: string;
};

export function GraphiteTextEditor({ rawQuery }: Props) {
  const dispatch = useDispatch();
  const theme = useTheme2();

  // Debounce change propagation for perf, like the Slate query field did:
  // every update re-parses the query model.
  const updateQuery = useMemo(
    () =>
      debounce((query: string) => {
        dispatch(actions.updateQuery({ query }));
      }, 500),
    [dispatch]
  );

  // Flush any pending edit on unmount (e.g. switching back to the visual
  // editor) so the last keystrokes are not lost.
  useEffect(() => () => updateQuery.flush(), [updateQuery]);

  const runQuery = useCallback(() => {
    // Push any pending edit into the state first so the executed query matches
    // what was typed.
    updateQuery.flush();
    dispatch(actions.runQuery());
  }, [updateQuery, dispatch]);

  const config = useMemo(
    () =>
      getQueryFieldConfig(theme, {
        placeholder: 'Enter a Graphite query (run with Shift+Enter)',
        onRunQuery: runQuery,
        onBlur: runQuery,
      }),
    [theme, runQuery]
  );

  return (
    <div data-testid={selectors.components.QueryField.container}>
      <CodeMirrorEditor value={rawQuery} onChange={updateQuery} height="auto" indentWithTab={false} {...config} />
    </div>
  );
}
