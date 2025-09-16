import { ChangeEvent, useCallback, useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { InlineField, Input } from '@grafana/ui';

import DataSource from '../../datasource';
import { migrateStringQueriesToObjectQueries } from '../../grafanaTemplateVariableFns';
import { AzureMonitorQuery, AzureQueryType } from '../../types/query';

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
    <InlineField
      label={t(
        'components.grafana-template-variable-fn-input.label-grafana-template-variable',
        'Grafana template variable function'
      )}
    >
      <Input
        placeholder={t(
          'components.grafana-template-variable-fn-input.placeholder-grafana-template-variable',
          'Type a grafana template variable function, e.g. {{example}}',
          { example: 'Subscriptions()' }
        )}
        value={inputVal}
        onChange={onChange}
        onBlur={() => onRunQuery(inputVal)}
      />
    </InlineField>
  );
};

export default GrafanaTemplateVariableFnInput;
