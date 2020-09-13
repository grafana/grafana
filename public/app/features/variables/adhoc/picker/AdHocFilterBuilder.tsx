import React, { FC, useCallback, useState } from 'react';
import { AdHocVariableFilter } from 'app/features/variables/types';
import { SelectableValue } from '@grafana/data';
import { AdHocFilterKey, REMOVE_FILTER_KEY } from './AdHocFilterKey';
import { AdHocFilterRenderer } from './AdHocFilterRenderer';

interface Props {
  datasource: string;
  onCompleted: (filter: AdHocVariableFilter) => void;
  appendBefore?: React.ReactNode;
}

export const AdHocFilterBuilder: FC<Props> = ({ datasource, appendBefore, onCompleted }) => {
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

  const onOperatorChanged = useCallback((item: SelectableValue<string>) => setOperator(item.value ?? ''), [
    setOperator,
  ]);

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
    [onCompleted, key, setKey, setOperator]
  );

  if (key === null) {
    return <AdHocFilterKey datasource={datasource} filterKey={key} onChange={onKeyChanged} />;
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
      />
    </React.Fragment>
  );
};
