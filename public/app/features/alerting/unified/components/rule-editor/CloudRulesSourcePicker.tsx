import { useCallback } from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { useRulesSourcesWithRuler } from '../../hooks/useRuleSourcesWithRuler';

interface Props {
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
