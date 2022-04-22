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

  const runQuery = useCallback(() => {
    dispatch(actions.runQuery());
  }, [dispatch]);

  return (
    <QueryField
      query={rawQuery}
      onChange={updateQuery}
      onBlur={runQuery}
      onRunQuery={runQuery}
      placeholder={'Enter a Graphite query (run with Shift+Enter)'}
      portalOrigin="graphite"
    />
  );
}
