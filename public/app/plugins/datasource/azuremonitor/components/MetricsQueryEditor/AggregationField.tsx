import { useCallback } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Select } from '@grafana/ui';

import { AzureMonitorOption, AzureQueryEditorFieldProps } from '../../types/types';
import { addValueToOptions } from '../../utils/common';
import { Field } from '../shared/Field';

import { setAggregation } from './setQueryValue';

interface AggregationFieldProps extends AzureQueryEditorFieldProps {
  aggregationOptions: AzureMonitorOption[];
  isLoading: boolean;
}

const AggregationField = ({
  query,
  variableOptionGroup,
  onQueryChange,
  aggregationOptions,
  isLoading,
}: AggregationFieldProps) => {
  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      if (!change.value) {
        return;
      }

      const newQuery = setAggregation(query, change.value);
      onQueryChange(newQuery);
    },
    [onQueryChange, query]
  );

  const options = addValueToOptions(aggregationOptions, variableOptionGroup, query.azureMonitor?.aggregation);

  return (
    <Field label={t('components.aggregation-field.label-aggregation', 'Aggregation')}>
      <Select
        inputId="azure-monitor-metrics-aggregation-field"
        value={query.azureMonitor?.aggregation || null}
        onChange={handleChange}
        options={options}
        isLoading={isLoading}
      />
    </Field>
  );
};

export default AggregationField;
