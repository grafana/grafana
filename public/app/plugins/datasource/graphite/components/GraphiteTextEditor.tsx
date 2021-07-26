import React, { useCallback, useEffect, useState } from 'react';
import { QueryField } from '@grafana/ui';
import { actions } from '../state/actions';
import { Dispatch } from 'redux';

type Props = {
  rawQuery: string;
  dispatch: Dispatch;
};

export function GraphiteTextEditor({ rawQuery, dispatch }: Props) {
  const [currentQuery, updateCurrentQuery] = useState<string>(rawQuery);

  const applyChanges = useCallback(() => {
    dispatch(actions.updateQuery({ query: currentQuery }));
  }, [dispatch, currentQuery]);

  // Needed for migration to React. State in QueryCtrl is initialized asynchronously (using init action) meaning
  // the angular js partial is rendered first with rawQuery=undefined and only once the state is initialized the
  // rawQuery is updated with the current query. At the same time in GraphiteTextEditor we need to keep track of
  // the query with managed state because onRunQuery callback doesn't provide the current value. This means that
  // the managed state is not updated when props change after the init action finishes and we need to use effect
  // to update it.
  useEffect(() => {
    updateCurrentQuery(rawQuery);
  }, [rawQuery]);

  return (
    <>
      <QueryField
        query={currentQuery}
        onChange={updateCurrentQuery}
        onBlur={applyChanges}
        onRunQuery={applyChanges}
        placeholder={'Enter a Graphite query (run with Shift+Enter)'}
        portalOrigin="graphite"
      />
    </>
  );
}
