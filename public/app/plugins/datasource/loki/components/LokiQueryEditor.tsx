// Libraries
import React, { PureComponent } from 'react';

// Types
import { AbsoluteTimeRange } from '@grafana/data';
import { QueryEditorProps, Switch, DataSourceStatus } from '@grafana/ui';
import { LokiDatasource } from '../datasource';
import { LokiQuery } from '../types';
import { LokiQueryField } from './LokiQueryField';

type Props = QueryEditorProps<LokiDatasource, LokiQuery>;

export class LokiQueryEditor extends PureComponent<Props> {
  onToggleLive = () => {
    const { query, onChange } = this.props;
    onChange({
      ...query,
      live: !query.live,
    });
  };

  render() {
    const { query, panelData, datasource, onChange, onRunQuery } = this.props;

    let absolute: AbsoluteTimeRange;
    if (panelData && panelData.request) {
      const { range } = panelData.request;
      absolute = {
        from: range.from.valueOf(),
        to: range.to.valueOf(),
      };
    } else {
      absolute = {
        from: Date.now() - 10000,
        to: Date.now(),
      };
    }

    return (
      <div>
        <LokiQueryField
          datasource={datasource}
          query={query}
          onChange={onChange}
          onRunQuery={onRunQuery}
          history={[]}
          panelData={panelData}
          // ??? What do we need here?
          syntaxLoaded={false}
          onLoadOptions={() => {}}
          logLabelOptions={[]}
          syntax={[]}
          datasourceStatus={DataSourceStatus.Connected}
          absoluteRange={absolute}
        />
        <div className="gf-form-inline">
          <div className="gf-form">
            <Switch label="Live" checked={!!query.live} onChange={this.onToggleLive} />
          </div>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </div>
      </div>
    );
  }
}

export default LokiQueryEditor;
