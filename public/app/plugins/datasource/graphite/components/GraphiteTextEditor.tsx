import { debounce } from 'lodash';
import React, { useCallback } from 'react';

import { QueryField } from '@grafana/ui';

import { actions } from '../state/actions';
import { useDispatch } from '../state/context';

type Props = {
  rawQuery: string;
};

export function GraphiteTextEditor({ rawQuery }: Props) {
  const dispatch = useDispatch();

  const updateQuery = useCallback(
    (query: string) => {
      dispatch(actions.updateQuery({ query }));
    },
    [dispatch]
  );

  // debounce the query to not run it on every keystroke
  // do this to allow updating query on copy and paste
  // issue https://github.com/grafana/grafana/issues/48145
  const updateQueryDebounced = debounce(updateQuery, 500);

  const runQuery = useCallback(() => {
    dispatch(actions.runQuery());
  }, [dispatch]);

  return (
    <QueryField
      query={rawQuery}
      onChange={updateQueryDebounced}
      onBlur={runQuery}
      onRunQuery={runQuery}
      placeholder={'Enter a Graphite query (run with Shift+Enter)'}
      portalOrigin="graphite"
    />
  );
}
