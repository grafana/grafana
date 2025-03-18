import i18n from 'i18next';
import { useCallback, useState } from 'react';
import * as React from 'react';

import { AdHocVariableFilter, DataSourceRef, SelectableValue } from '@grafana/data';

import { AdHocFilterKey, REMOVE_FILTER_KEY } from './AdHocFilterKey';
import { AdHocFilterRenderer } from './AdHocFilterRenderer';

interface Props {
  datasource: DataSourceRef;
  onCompleted: (filter: AdHocVariableFilter) => void;
  appendBefore?: React.ReactNode;
  allFilters: AdHocVariableFilter[];
}

// Reassign t() so i18next-parser doesn't warn on dynamic key, and we can have 'failOnWarnings' enabled
const tFunc = i18n.t;

// import { t } from 'app/core/internationalization';
export const t = (id: string, defaultMessage: string, values?: Record<string, unknown>) => {
  return tFunc(id, defaultMessage, values);
};

export const AdHocFilterBuilder = ({ datasource, appendBefore, onCompleted, allFilters }: Props) => {
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
        key: key!,
      });
      setKey(null);
      setOperator('=');
    },
    [onCompleted, operator, key]
  );

  if (key === null) {
    return <AdHocFilterKey datasource={datasource} filterKey={key} onChange={onKeyChanged} allFilters={allFilters} />;
  }

  return (
    <React.Fragment key="filter-builder">
      {appendBefore}
      <AdHocFilterRenderer
        datasource={datasource}
        filter={{ key, value: '', operator }}
        placeHolder={t('variable.adhoc.placeholder', 'Select value')}
        onKeyChange={onKeyChanged}
        onOperatorChange={onOperatorChanged}
        onValueChange={onValueChanged}
        allFilters={allFilters}
      />
    </React.Fragment>
  );
};
