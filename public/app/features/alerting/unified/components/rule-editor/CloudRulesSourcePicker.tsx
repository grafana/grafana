import React, { useCallback } from 'react';
import { useAsync } from 'react-use';

import { DataSourceInstanceSettings } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { dispatch } from 'app/store/store';

import { useRulesSourcesWithRuler } from '../../hooks/useRuleSourcesWithRuler';
import { fetchAllPromBuildInfoAction } from '../../state/actions';

interface Props {
  onChange: (ds: DataSourceInstanceSettings) => void;
  value: string | null;
  onBlur?: () => void;
  name?: string;
}

export function CloudRulesSourcePicker({ value, ...props }: Props): JSX.Element {
  const rulesSourcesWithRuler = useRulesSourcesWithRuler();

  const { loading = true } = useAsync(() => dispatch(fetchAllPromBuildInfoAction()), [dispatch]);

  const dataSourceFilter = useCallback(
    (ds: DataSourceInstanceSettings): boolean => {
      return !!rulesSourcesWithRuler.find(({ id }) => id === ds.id);
    },
    [rulesSourcesWithRuler]
  );

  return (
    <DataSourcePicker
      disabled={loading}
      isLoading={loading}
      noDefault
      alerting
      filter={dataSourceFilter}
      current={value}
      {...props}
    />
  );
}
