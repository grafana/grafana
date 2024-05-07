import React, { ChangeEvent, PureComponent } from 'react';
import uniqueId from 'lodash/uniqueId';

import { Button, Icon, InlineFieldRow, InlineField, Select, Input, InlineFormLabel } from '@grafana/ui';
import { AggregateType, Aggregations, GetQuery } from './types';
import { SelectableValue } from '@grafana/data';
import { aggregateInfos, numberOfFieldsForAggregateType } from 'queryInfo';

interface State {
  aggregations: Aggregations;
};

interface AggregationSettingsProps {
  query: GetQuery;
  onChange: (query: GetQuery) => void;
};

export class AggregationSettings extends PureComponent<AggregationSettingsProps, State> {
  state: State = {
    aggregations: []
  };

  constructor(props: AggregationSettingsProps) {
    super(props);
    this.state = {
      aggregations: this.props.query.aggregations || []
    };
  };

  updateSettings = () => {
    const { aggregations } = this.state;

    this.props.onChange({
      ...this.props.query,
      aggregations: aggregations,
    });
  };

  onAggregationAdd = () => {
    this.setState((prevState) => {
      return { aggregations: [...prevState.aggregations, { id: uniqueId(), alias: '', type: AggregateType.Sum, fields: [''] }] };
    });
  };

  onAggregationTypeChange = (aggregationIndex: number, value: SelectableValue<AggregateType>) => {
    this.setState(({ aggregations }) => {
      return {
        aggregations: aggregations.map((aggregation, i) => {
          if (aggregationIndex !== i) {
            return aggregation;
          }
          const numberOfNewFields = numberOfFieldsForAggregateType.get(value.value!)!;
          let newFields = aggregation.fields;
          if (aggregation.fields.length < numberOfNewFields) {
            newFields.push('');
          } else if (aggregation.fields.length > numberOfNewFields) {
            newFields.pop();
          }
          return {
            ...aggregation,
            type: value.value!,
            fields: newFields
          };
        })
      };
    }, this.updateSettings);
  };

  onAggregationFieldChange = (aggregationIndex: number, fieldIndex: number, value: SelectableValue<string>) => {
    this.setState(({ aggregations }) => {
      return {
        aggregations: aggregations.map((aggregation, i) => {
          if (aggregationIndex !== i) {
            return aggregation;
          }
          return {
            ...aggregation,
            fields: aggregation.fields.map((field, j) => {
              if (fieldIndex !== j) {
                return field;
              }
              return value.value!;
            })
          };
        })
      };
    }, this.updateSettings);
  };

  onAggregationAliasChange = (aggregationIndex: number, value: ChangeEvent<HTMLInputElement>) => {
    this.setState(({ aggregations }) => {
      return {
        aggregations: aggregations.map((aggregation, i) => {
          if (aggregationIndex !== i) {
            return aggregation;
          }
          return { ...aggregation, alias: value.target.value };
        })
      };
    }, this.updateSettings);
  };

  onAggregationRemove = (aggregationId: string) => {
    this.setState(
      ({ aggregations }) => ({
        aggregations: aggregations.filter((h) => h.id !== aggregationId),
      }),
      this.updateSettings
    );
  };

  render() {
    const aggregations = this.state.aggregations;
    const metrics = this.props.query.metrics?.map((m) => ({ label: m.metricId, value: m.metricId }));
    return (
      <div className="gf-form-group">
        <div className="gf-form">
          <h6>Aggregations</h6>
        </div>
        {aggregations.map((aggregation, i) => (
          <InlineFieldRow>
            <InlineField label="Alias" labelWidth={20}>
              <Input
                value={aggregation.alias}
                width={25}
                onChange={(v: ChangeEvent<HTMLInputElement>) => {
                  this.onAggregationAliasChange(i, v);
                }}
              />
            </InlineField>
            <InlineField label="Type" labelWidth={20}>
              <Select
                options={aggregateInfos}
                value={aggregation.type}
                width={25}
                onChange={(v) => {
                  this.onAggregationTypeChange(i, v);
                }}
              />
            </InlineField>
            <InlineFormLabel width={10}>
              Metric(s)
            </InlineFormLabel>
            {aggregation.fields.map((field, j) => (
              <InlineField>
                <Select
                  options={metrics}
                  value={field}
                  width={25}
                  onChange={(v) => {
                    this.onAggregationFieldChange(i, j, v);
                  }} />
              </InlineField>
            ))}
            <Button variant="secondary" size="xs" onClick={() => this.onAggregationRemove(aggregation.id)}>
              <Icon name="trash-alt" />
            </Button>
          </InlineFieldRow>
        ))}
        <Button
          type="button"
          variant="secondary"
          icon="plus"
          onClick={() => {
            this.onAggregationAdd();
          }}
        >
          Add Aggregation
        </Button>
      </div>
    );
  }
};

export default AggregationSettings;
