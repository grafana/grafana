import React, { useCallback } from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';

import { useRulesSourcesWithRuler } from '../../hooks/useRuleSourcesWithRuler';

interface Props {
  onChange: (ds: DataSourceInstanceSettings) => void;
  value: string | null;
  onBlur?: () => void;
  name?: string;
}

export function CloudRulesSourcePicker({ value, ...props }: Props): JSX.Element {
  const rulesSourcesWithRuler = useRulesSourcesWithRuler();

  const dataSourceFilter = useCallback(
    (ds: DataSourceInstanceSettings): boolean => {
      return !!rulesSourcesWithRuler.find(({ id }) => id === ds.id);
    },
    [rulesSourcesWithRuler]
  );

  return <DataSourcePicker noDefault alerting filter={dataSourceFilter} current={value} {...props} />;
}
