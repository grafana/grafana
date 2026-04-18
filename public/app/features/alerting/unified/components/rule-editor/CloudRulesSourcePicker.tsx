import { type JSX, useCallback } from 'react';

import { type DataSourceInstanceSettings } from '@grafana/data';
import {
  DataSourcePicker,
  type DataSourcePickerProps,
} from 'app/features/datasources/components/picker/DataSourcePicker';

import { useRulesSourcesWithRuler } from '../../hooks/useRuleSourcesWithRuler';

interface Props extends DataSourcePickerProps {
  disabled?: boolean;
  onChange: (ds: DataSourceInstanceSettings) => void;
  value: string | null;
  onBlur?: () => void;
  name?: string;
}

export function CloudRulesSourcePicker({ value, disabled, ...props }: Props): JSX.Element {
  const { rulesSourcesWithRuler: dataSourcesWithRuler, isLoading } = useRulesSourcesWithRuler();

  const dataSourceFilter = useCallback(
    (ds: DataSourceInstanceSettings): boolean => {
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
