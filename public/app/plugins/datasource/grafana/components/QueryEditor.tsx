import defaults from 'lodash/defaults';

import React, { PureComponent } from 'react';
import { InlineField, Select, FeatureInfoBox } from '@grafana/ui';
import { QueryEditorProps, SelectableValue, FeatureState, getFrameDisplayName } from '@grafana/data';
import { GrafanaDatasource } from '../datasource';
import { defaultQuery, GrafanaQuery, GrafanaQueryType } from '../types';

type Props = QueryEditorProps<GrafanaDatasource, GrafanaQuery>;

const labelWidth = 12;

export class QueryEditor extends PureComponent<Props> {
  queryTypes: Array<SelectableValue<GrafanaQueryType>> = [
    {
      label: 'Random Walk',
      value: GrafanaQueryType.RandomWalk,
      description: 'Random signal within the selected time range',
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

  onFieldNamesChange = (item: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    let fields: string[] = [];
    if (Array.isArray(item)) {
      fields = item.map((v) => v.value);
    } else if (item.value) {
      fields = [item.value];
    }

    onChange({
      ...query,
      filter: {
        ...query.filter,
        fields,
      },
    });
    onRunQuery();
  };

  renderMeasurementsQuery() {
    const { data } = this.props;
    let { channel, filter } = this.props.query;
    const channels: Array<SelectableValue<string>> = [
      {
        value: 'plugin/testdata/random-2s-stream',
        label: 'plugin/testdata/random-2s-stream',
      },
      {
        value: 'plugin/testdata/random-flakey-stream',
        label: 'plugin/testdata/random-flakey-stream',
      },
    ];
    let currentChannel = channels.find((c) => c.value === channel);
    if (channel && !currentChannel) {
      currentChannel = {
        value: channel,
        label: channel,
        description: `Connected to ${channel}`,
      };
      channels.push(currentChannel);
    }

    const distinctFields = new Set<string>();
    const fields: Array<SelectableValue<string>> = [];
    if (data && data.series?.length) {
      for (const frame of data.series) {
        for (const field of frame.fields) {
          if (distinctFields.has(field.name) || !field.name) {
            continue;
          }
          fields.push({
            value: field.name,
            label: field.name,
            description: `(${getFrameDisplayName(frame)} / ${field.type})`,
          });
          distinctFields.add(field.name);
        }
      }
    }
    if (filter?.fields) {
      for (const f of filter.fields) {
        if (!distinctFields.has(f)) {
          fields.push({
            value: f,
            label: `${f} (not loaded)`,
            description: `Configured, but not found in the query results`,
          });
          distinctFields.add(f);
        }
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
            <InlineField label="Fields" grow={true} labelWidth={labelWidth}>
              <Select
                options={fields}
                value={filter?.fields || []}
                onChange={this.onFieldNamesChange}
                allowCustomValue={true}
                backspaceRemovesValue={true}
                placeholder="All fields"
                isClearable={true}
                noOptionsMessage="Unable to list all fields"
                formatCreateLabel={(input: string) => `Field: ${input}`}
                isSearchable={true}
                isMulti={true}
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
              value={this.queryTypes.find((v) => v.value === query.queryType) || this.queryTypes[0]}
              onChange={this.onQueryTypeChange}
            />
          </InlineField>
        </div>
        {query.queryType === GrafanaQueryType.LiveMeasurements && this.renderMeasurementsQuery()}
      </>
    );
  }
}
