import React, { ChangeEvent, useCallback, useEffect, useState } from 'react';

import { InlineField, Input } from '@grafana/ui';

import DataSource from '../../datasource';
import { migrateStringQueriesToObjectQueries } from '../../grafanaTemplateVariableFns';
import { AzureMonitorQuery, AzureQueryType } from '../../types';

const GrafanaTemplateVariableFnInput = ({
  query,
  updateQuery,
  datasource,
}: {
  query: AzureMonitorQuery;
  updateQuery: (val: AzureMonitorQuery) => void;
  datasource: DataSource;
}) => {
  const [inputVal, setInputVal] = useState('');

  useEffect(() => {
    setInputVal(query.grafanaTemplateVariableFn?.rawQuery || '');
  }, [query.grafanaTemplateVariableFn?.rawQuery]);

  const onRunQuery = useCallback(
    (newQuery: string) => {
      migrateStringQueriesToObjectQueries(newQuery, { datasource }).then((updatedQuery) => {
        if (updatedQuery.queryType === AzureQueryType.GrafanaTemplateVariableFn) {
          updateQuery(updatedQuery);
        } else {
          updateQuery({
            ...query,
            grafanaTemplateVariableFn: {
              kind: 'UnknownQuery',
              rawQuery: newQuery,
            },
          });
        }
      });
    },
    [datasource, query, updateQuery]
  );

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInputVal(event.target.value);
  };

  return (
    <InlineField label="Grafana template variable function">
      <Input
        placeholder={'type a grafana template variable function, ex: Subscriptions()'}
        value={inputVal}
        onChange={onChange}
        onBlur={() => onRunQuery(inputVal)}
      />
    </InlineField>
  );
};

export default GrafanaTemplateVariableFnInput;
