import { type JSX, useCallback } from 'react';

import { type DataSourceInstanceListItem } from '@grafana/data';
import {
  DataSourcePicker,
  type DataSourcePickerProps,
} from 'app/features/datasources/components/picker/DataSourcePicker';

import { type RulesSourcesWithRulerResult } from '../../hooks/useRuleSourcesWithRuler';

// Picked fields keep the callbacks compatible with both the current picker and the slim list item.
type RulesSourceOption = Pick<DataSourceInstanceListItem, 'uid' | 'name' | 'type'>;

interface Props extends DataSourcePickerProps {
  /** From `useRulesSourcesWithRuler`. The parent calls the hook, so that its `Field` can show the list error. */
  rulesSources: RulesSourcesWithRulerResult;
  disabled?: boolean;
  onChange: (ds: RulesSourceOption) => void;
  value: string | null;
  onBlur?: () => void;
  name?: string;
}

export function CloudRulesSourcePicker({ value, disabled, rulesSources, ...props }: Props): JSX.Element {
  const { rulesSourcesWithRuler: dataSourcesWithRuler, isLoading } = rulesSources;

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
