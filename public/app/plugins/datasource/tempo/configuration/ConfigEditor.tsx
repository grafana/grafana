import React from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { DataSourceHttpSettings } from '@grafana/ui';
import { NodeGraphSettings } from 'app/core/components/NodeGraphSettings';
import { TraceToLogsSettings } from 'app/core/components/TraceToLogs/TraceToLogsSettings';

import { LokiSearchSettings } from './LokiSearchSettings';
import { SearchSettings } from './SearchSettings';
import { ServiceGraphSettings } from './ServiceGraphSettings';

export type Props = DataSourcePluginOptionsEditorProps;

export const ConfigEditor: React.FC<Props> = ({ options, onOptionsChange }) => {
  return (
    <>
      <DataSourceHttpSettings
        defaultUrl="http://tempo"
        dataSourceConfig={options}
        showAccessOptions={false}
        onChange={onOptionsChange}
      />

      <div className="gf-form-group">
        <TraceToLogsSettings options={options} onOptionsChange={onOptionsChange} />
      </div>
      {config.featureToggles.tempoServiceGraph && (
        <div className="gf-form-group">
          <ServiceGraphSettings options={options} onOptionsChange={onOptionsChange} />
        </div>
      )}
      {config.featureToggles.tempoSearch && (
        <div className="gf-form-group">
          <SearchSettings options={options} onOptionsChange={onOptionsChange} />
        </div>
      )}
      <div className="gf-form-group">
        <NodeGraphSettings options={options} onOptionsChange={onOptionsChange} />
      </div>
      <div className="gf-form-group">
        <LokiSearchSettings options={options} onOptionsChange={onOptionsChange} />
      </div>
    </>
  );
};
