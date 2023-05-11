import React from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema';

import { useDatasources } from '../../hooks';

import { DataSourceCard } from './DataSourceCard';

const CUSTOM_DESCRIPTIONS_BY_UID: Record<string, string> = {
  grafana: 'Discover visualizations using mock data',
  '-- Mixed --': 'Use multiple data sources',
  '-- Dashboard --': 'Reuse query results from other visualizations',
};

interface BuiltInDataSourceListProps {
  className?: string;
  current: DataSourceRef | string | null | undefined;
  onChange: (ds: DataSourceInstanceSettings) => void;
}

export function BuiltInDataSourceList({ className, current, onChange }: BuiltInDataSourceListProps) {
  const grafanaDataSources = useDatasources({ mixed: true, dashboard: true, filter: (ds) => !!ds.meta.builtIn });

  return (
    <div className={className}>
      {grafanaDataSources.map((ds) => {
        return (
          <DataSourceCard
            key={ds.id}
            ds={ds}
            description={CUSTOM_DESCRIPTIONS_BY_UID[ds.uid]}
            selected={current === ds.id}
            onClick={() => onChange(ds)}
          />
        );
      })}
    </div>
  );
}
