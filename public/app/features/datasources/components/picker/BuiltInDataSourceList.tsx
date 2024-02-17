import React from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { DataSourceRef } from '@grafana/schema';
import { t } from 'app/core/internationalization';

import { useDatasources } from '../../hooks';

import { DataSourceCard } from './DataSourceCard';
import { isDataSourceMatch } from './utils';

const CUSTOM_DESCRIPTIONS_BY_UID: Record<string, string> = {
  grafana: t('data-source-picker.built-in-list.description-grafana', 'Discover visualizations using mock data'),
  '-- Mixed --': t('data-source-picker.built-in-list.description-mixed', 'Use multiple data sources'),
  '-- Dashboard --': t(
    'data-source-picker.built-in-list.description-dashboard',
    'Reuse query results from other visualizations'
  ),
};

interface BuiltInDataSourceListProps {
  className?: string;
  current: DataSourceRef | string | null | undefined;
  onChange: (ds: DataSourceInstanceSettings) => void;

  // DS filters
  filter?: (ds: DataSourceInstanceSettings) => boolean;
  tracing?: boolean;
  mixed?: boolean;
  dashboard?: boolean;
  metrics?: boolean;
  type?: string | string[];
  annotations?: boolean;
  variables?: boolean;
  alerting?: boolean;
  pluginId?: string;
  logs?: boolean;
}

export function BuiltInDataSourceList({
  className,
  current,
  onChange,
  tracing,
  dashboard,
  mixed,
  metrics,
  type,
  annotations,
  variables,
  alerting,
  pluginId,
  logs,
  filter,
}: BuiltInDataSourceListProps) {
  const grafanaDataSources = useDatasources({
    tracing,
    dashboard,
    mixed,
    metrics,
    type,
    annotations,
    variables,
    alerting,
    pluginId,
    logs,
  });

  const filteredResults = grafanaDataSources.filter((ds) => (filter ? filter?.(ds) : true) && !!ds.meta.builtIn);

  return (
    <div className={className} data-testid={selectors.components.DataSourcePicker.advancedModal.builtInDataSourceList}>
      {filteredResults.map((ds) => {
        return (
          <DataSourceCard
            key={ds.uid}
            ds={ds}
            description={CUSTOM_DESCRIPTIONS_BY_UID[ds.uid]}
            selected={isDataSourceMatch(ds, current)}
            onClick={() => onChange(ds)}
          />
        );
      })}
    </div>
  );
}
