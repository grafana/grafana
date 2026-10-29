import { type JSX, useCallback } from 'react';

import { type DataSourceInstanceListItem } from '@grafana/data';
import {
  DataSourcePicker,
  type DataSourcePickerProps,
} from 'app/features/datasources/components/picker/DataSourcePicker';

import { useRulesSourcesWithRuler } from '../../hooks/useRuleSourcesWithRuler';

// Picked fields keep the callbacks compatible with both the current picker and the slim list item.
type RulesSourceOption = Pick<DataSourceInstanceListItem, 'uid' | 'name' | 'type'>;

interface Props extends DataSourcePickerProps {
  disabled?: boolean;
  onChange: (ds: RulesSourceOption) => void;
  value: string | null;
  onBlur?: () => void;
  name?: string;
}

export function CloudRulesSourcePicker({ value, disabled, ...props }: Props): JSX.Element {
  const { rulesSourcesWithRuler: dataSourcesWithRuler, isLoading } = useRulesSourcesWithRuler();

  const dataSourceFilter = useCallback(
    (ds: RulesSourceOption): boolean => {
      return dataSourcesWithRuler.some(({ uid }) => uid === ds.uid);
    },
    [dataSourcesWithRuler]
  );

  return (
    <DataSourcePicker
      disabled={isLoading || disabled}
      noDefault
      alerting
      filter={dataSourceFilter}
      current={value}
      {...props}
    />
  );
}
