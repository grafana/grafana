import React, { useCallback, useState } from 'react';
import { QueryField } from '@grafana/ui';
import { actions } from '../state/actions';

type Props = {
  rawQuery: string;
  dispatch: any;
};

export function GraphiteTextEditor({ rawQuery, dispatch }: Props) {
  const [currentQuery, updateCurrentQuery] = useState<string>(rawQuery);

  const applyChanges = useCallback(() => {
    dispatch(actions.updateQuery({ query: currentQuery }));
  }, [dispatch, currentQuery]);

  return (
    <>
      <QueryField
        query={rawQuery}
        onChange={updateCurrentQuery}
        onBlur={applyChanges}
        onRunQuery={applyChanges}
        placeholder={'Enter a Graphite query (run with Shift+Enter)'}
        portalOrigin="graphite"
      />
    </>
  );
}
