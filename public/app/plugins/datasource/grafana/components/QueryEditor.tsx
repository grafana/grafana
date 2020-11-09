import defaults from 'lodash/defaults';

import React, { PureComponent } from 'react';
import { InlineField, Select, FeatureInfoBox } from '@grafana/ui';
import { QueryEditorProps, SelectableValue, LiveChannelScope, FeatureState } from '@grafana/data';
import { getLiveMeasurements, LiveMeasurements } from '@grafana/runtime';
import { GrafanaDatasource } from '../datasource';
import { defaultQuery, GrafanaQuery, GrafanaQueryType } from '../types';

type Props = QueryEditorProps<GrafanaDatasource, GrafanaQuery>;

const labelWidth = 12;

export class QueryEditor extends PureComponent<Props> {
  queryTypes: Array<SelectableValue<GrafanaQueryType>> = [
    {
      label: 'Random Walk',
      value: GrafanaQueryType.RandomWalk,
      description: 'Random signal within the selected time rage',
    },
    {
      label: 'Live Measurements',
      value: GrafanaQueryType.LiveMeasurements,
      description: 'Stream real-time measurements from Grafana',
    },
  ];

  onQueryTypeChange = (sel: SelectableValue<GrafanaQueryType>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, queryType: sel.value! });
    onRunQuery();
  };

  onChannelChange = (sel: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, channel: sel?.value });
    onRunQuery();
  };

  onMeasurementNameChanged = (sel: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({
      ...query,
      measurements: {
        ...query.measurements,
        name: sel?.value,
      },
    });
    onRunQuery();
  };

  renderMeasurementsQuery() {
    let { channel, measurements } = this.props.query;
    const channels: Array<SelectableValue<string>> = [];
    let currentChannel = channels.find(c => c.value === channel);
    if (channel && !currentChannel) {
      currentChannel = {
        value: channel,
        label: channel,
        description: `Connected to ${channel}`,
      };
      channels.push(currentChannel);
    }

    if (!measurements) {
      measurements = {};
    }
    const names: Array<SelectableValue<string>> = [
      { value: '', label: 'All measurements', description: 'Show every measurement streamed to this channel' },
    ];

    let info: LiveMeasurements | undefined = undefined;
    if (channel) {
      info = getLiveMeasurements({
        scope: LiveChannelScope.Grafana,
        namespace: 'measurements',
        path: channel,
      });

      let foundName = false;
      if (info) {
        for (const name of info.getDistinctNames()) {
          names.push({
            value: name,
            label: name,
          });
          if (name === measurements.name) {
            foundName = true;
          }
        }
      } else {
        console.log('NO INFO for', channel);
      }

      if (measurements.name && !foundName) {
        names.push({
          label: measurements.name,
          value: measurements.name,
          description: `Frames with name ${measurements.name}`,
        });
      }
    }

    return (
      <>
        <div className="gf-form">
          <InlineField label="Channel" grow={true} labelWidth={labelWidth}>
            <Select
              options={channels}
              value={currentChannel || ''}
              onChange={this.onChannelChange}
              allowCustomValue={true}
              backspaceRemovesValue={true}
              placeholder="Select measurements channel"
              isClearable={true}
              noOptionsMessage="Enter channel name"
              formatCreateLabel={(input: string) => `Connect to: ${input}`}
            />
          </InlineField>
        </div>
        {channel && (
          <div className="gf-form">
            <InlineField label="Measurement" grow={true} labelWidth={labelWidth}>
              <Select
                options={names}
                value={names.find(v => v.value === measurements?.name) || names[0]}
                onChange={this.onMeasurementNameChanged}
                allowCustomValue={true}
                backspaceRemovesValue={true}
                placeholder="Filter by name"
                isClearable={true}
                noOptionsMessage="Filter by name"
                formatCreateLabel={(input: string) => `Show: ${input}`}
                isSearchable={true}
              />
            </InlineField>
          </div>
        )}

        <FeatureInfoBox title="Grafana Live - Measurements" featureState={FeatureState.alpha}>
          <p>
            This supports real-time event streams in Grafana core. This feature is under heavy development. Expect the
            interfaces and structures to change as this becomes more production ready.
          </p>
        </FeatureInfoBox>
      </>
    );
  }

  render() {
    const query = defaults(this.props.query, defaultQuery);
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
        {query.queryType === GrafanaQueryType.LiveMeasurements && this.renderMeasurementsQuery()}
      </>
    );
  }
}
