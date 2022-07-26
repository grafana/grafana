import React, { FC, useCallback, useState } from 'react';

import { DataSourceRef, SelectableValue } from '@grafana/data';
import { AdHocVariableFilter } from 'app/features/variables/types';

import { AdHocFilterKey, REMOVE_FILTER_KEY } from './AdHocFilterKey';
import { AdHocFilterRenderer } from './AdHocFilterRenderer';

interface Props {
  datasource: DataSourceRef;
  onCompleted: (filter: AdHocVariableFilter) => void;
  appendBefore?: React.ReactNode;
  getTagKeysOptions?: any;
}

export const AdHocFilterBuilder: FC<Props> = ({ datasource, appendBefore, onCompleted, getTagKeysOptions }) => {
  const [key, setKey] = useState<string | null>(null);
  const [operator, setOperator] = useState<string>('=');

  const onKeyChanged = useCallback(
    (item: SelectableValue<string | null>) => {
      if (item.value !== REMOVE_FILTER_KEY) {
        setKey(item.value ?? '');
        return;
      }
      setKey(null);
    },
    [setKey]
  );

  const onOperatorChanged = useCallback(
    (item: SelectableValue<string>) => setOperator(item.value ?? ''),
    [setOperator]
  );

  const onValueChanged = useCallback(
    (item: SelectableValue<string>) => {
      onCompleted({
        value: item.value ?? '',
        operator: operator,
        condition: '',
        key: key!,
      });
      setKey(null);
      setOperator('=');
    },
    [onCompleted, operator, key]
  );

  if (key === null) {
    return (
      <AdHocFilterKey
        datasource={datasource}
        filterKey={key}
        onChange={onKeyChanged}
        getTagKeysOptions={getTagKeysOptions}
      />
    );
  }

  return (
    <React.Fragment key="filter-builder">
      {appendBefore}
      <AdHocFilterRenderer
        datasource={datasource}
        filter={{ key, value: '', operator, condition: '' }}
        placeHolder="select value"
        onKeyChange={onKeyChanged}
        onOperatorChange={onOperatorChanged}
        onValueChange={onValueChanged}
        getTagKeysOptions={getTagKeysOptions}
      />
    </React.Fragment>
  );
};
