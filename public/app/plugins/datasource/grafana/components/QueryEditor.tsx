import defaults from 'lodash/defaults';

import React, { PureComponent } from 'react';
import { InlineField, Select } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { GrafanaDatasource } from '../datasource';
import { defaultQuery, GrafanaQuery, GrafanaQueryType } from '../types';
import { config } from 'app/core/config';

type Props = QueryEditorProps<GrafanaDatasource, GrafanaQuery>;

export class QueryEditor extends PureComponent<Props> {
  queryTypes: Array<SelectableValue<GrafanaQueryType>> = [
    {
      label: 'Random Walk',
      value: GrafanaQueryType.RandomWalk,
      description: 'Random signal within the selected time rage',
    },
    {
      label: 'Internal Metrics (live)',
      value: GrafanaQueryType.LiveMetrics,
      description: 'Real-time server metrics that update at 1hz',
    },
  ];

  channels: Array<SelectableValue<string>> = [
    {
      label: 'Live stats',
      value: 'live',
      description: 'Realtime stats for the live websocket server',
    },
  ];

  onQueryTypeChange = (sel: SelectableValue<GrafanaQueryType>) => {
    const { onChange, query, onRunQuery } = this.props;
    const copy = { ...query, queryType: sel.value! };
    if (copy.queryType === GrafanaQueryType.LiveMetrics) {
      if (!copy.channel) {
        copy.channel = this.channels[0].value!;
      }
    } else if (copy.channel) {
      delete copy.channel;
    }
    onChange(copy);
    onRunQuery();
  };

  onChannelChange = (sel: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, channel: sel.value! });
    onRunQuery();
  };

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const labelWidth = 12;
    const showLive = query.queryType === GrafanaQueryType.LiveMetrics && config.featureToggles.live;

    return (
      <>
        <div className="gf-form">
          <InlineField label="Query type" grow={true} labelWidth={labelWidth}>
            <Select
              options={this.queryTypes}
              value={this.queryTypes.find(v => v.value === query.queryType) || this.queryTypes[0]}
              onChange={this.onQueryTypeChange}
            />
          </InlineField>
        </div>
        {showLive && (
          <div className="gf-form">
            <InlineField label="Channel" grow={true} labelWidth={labelWidth}>
              <Select
                options={this.channels}
                value={this.channels.find(v => v.value === query.channel) || this.channels[0]}
                onChange={this.onChannelChange}
              />
            </InlineField>
          </div>
        )}
      </>
    );
  }
}
