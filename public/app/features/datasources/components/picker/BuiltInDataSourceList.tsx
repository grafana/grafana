import { DataSourceInstanceSettings } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { DataSourceRef } from '@grafana/schema';

import { useDatasources } from '../../hooks';

import { DataSourceCard } from './DataSourceCard';
import { isDataSourceMatch } from './utils';

function getCustomDescription(datasourceUid: string) {
  switch (datasourceUid) {
    case 'grafana':
      return t('data-source-picker.built-in-list.description-grafana', 'Discover visualizations using mock data');
    case '-- Mixed --':
      return t('data-source-picker.built-in-list.description-mixed', 'Use multiple data sources');
    case '-- Dashboard --':
      return t(
        'data-source-picker.built-in-list.description-dashboard',
        'Reuse query results from other visualizations'
      );
    default:
      return '';
  }
}

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
            description={getCustomDescription(ds.uid)}
            selected={isDataSourceMatch(ds, current)}
            onClick={() => onChange(ds)}
          />
        );
      })}
    </div>
  );
}
