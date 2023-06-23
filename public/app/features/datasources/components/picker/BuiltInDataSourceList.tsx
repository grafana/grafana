import React from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema';

import { useDatasources } from '../../hooks';

import { DataSourceCard } from './DataSourceCard';
import { isDataSourceMatch } from './utils';

const CUSTOM_DESCRIPTIONS_BY_UID: Record<string, string> = {
  grafana: 'Discover visualizations using mock data',
  '-- Mixed --': 'Use multiple data sources',
  '-- Dashboard --': 'Reuse query results from other visualizations',
};

interface BuiltInDataSourceListProps {
  className?: string;
  current: DataSourceRef | string | null | undefined;
  onChange: (ds: DataSourceInstanceSettings) => void;
  dashboard?: boolean;
  mixed?: boolean;
}

export function BuiltInDataSourceList({ className, current, onChange, dashboard, mixed }: BuiltInDataSourceListProps) {
  const grafanaDataSources = useDatasources({ mixed, dashboard, filter: (ds) => !!ds.meta.builtIn });

  return (
    <div className={className} data-testid="built-in-data-sources-list">
      {grafanaDataSources.map((ds) => {
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
