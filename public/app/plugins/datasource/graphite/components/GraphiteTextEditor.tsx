import React, { useCallback, useState } from 'react';
import { QueryField } from '@grafana/ui';
import { actions } from '../state/actions';

type Props = {
  rawQuery: string;
  dispatch: any;
};

export function GraphiteTextEditor(props: Props) {
  const [currentQuery, updateCurrentQuery] = useState<string>(props.rawQuery);

  const applyChanges = useCallback(() => {
    props.dispatch(actions.updateQuery({ query: currentQuery }));
  }, [props.dispatch, currentQuery]);

  return (
    <>
      <QueryField
        query={props.rawQuery}
        onChange={updateCurrentQuery}
        onBlur={applyChanges}
        onRunQuery={applyChanges}
        placeholder={'Enter a Graphite query (run with Shift+Enter)'}
        portalOrigin="graphite"
      />
    </>
  );
}
