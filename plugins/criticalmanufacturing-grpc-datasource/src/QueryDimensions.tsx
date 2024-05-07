import React, { PureComponent } from 'react';
import uniqueId from 'lodash/uniqueId';

import { Button, Icon, AsyncSelect, InlineFieldRow, InlineField, Select, Input } from '@grafana/ui';
import { GetQuery, Dimensions, OperatorType } from './types';
import { SelectableValue } from '@grafana/data';
import { DataSource } from 'datasource';
import { operatorTypeInfos } from 'queryInfo';

interface State {
  dimensions: Dimensions;
  isLoadingKey: boolean;
  isLoadingValue: boolean;
};

interface DimensionSettingsProps {
  query: GetQuery;
  datasource: DataSource;
  onChange: (query: GetQuery) => void;
  label?: string;
};

export class DimensionSettings extends PureComponent<DimensionSettingsProps, State> {
  state: State = {
    dimensions: [],
    isLoadingKey: false,
    isLoadingValue: false
  };

  constructor(props: DimensionSettingsProps) {
    super(props);
    const { dimensions } = this.props.query;
    this.state = {
      dimensions: dimensions || [],
      isLoadingKey: false,
      isLoadingValue: false
    };
  }

  componentWillReceiveProps(props: DimensionSettingsProps) {
    this.setState({ dimensions: props.query.dimensions ?? [] })
  }

  updateSettings = () => {
    const { dimensions } = this.state;

    this.props.onChange({
      ...this.props.query,
      dimensions: dimensions,
    });
  };

  onDimensionAdd = () => {
    this.setState((prevState) => {
      return { dimensions: [...prevState.dimensions, { id: uniqueId(), key: '', value: '' }] };
    });
  };

  onDimensionRemove = (dimensionId: string) => {
    this.setState(
      ({ dimensions }) => ({
        dimensions: dimensions.filter((h) => h.id !== dimensionId),
      }),
      this.updateSettings
    );
  };

  getDimensionKeys = async (): Promise<Array<SelectableValue<string>>> => {
    const selectedDataset = this.props.query.dataset;
    if (selectedDataset != undefined) {
      return await this.props.datasource.listDimensionKeys(selectedDataset);
    } else {
      return [];
    }
  };

  getDimensionValues = async (key: string | undefined): Promise<Array<SelectableValue<string>>> => {
    const selectedDataset = this.props.query.dataset;
    if (selectedDataset != undefined && key != undefined) {
      return this.props.datasource.listDimensionValues(key, '', selectedDataset, true);
    } else {
      return [];
    }
  };

  onDimensionKeyChange = (dimensionIndex: number, value: SelectableValue<string>) => {
    this.setState(({ dimensions }) => {
      return {
        dimensions: dimensions.map((dimension, i) => {
          if (dimensionIndex !== i) {
            return dimension;
          }
          return {
            ...dimension,
            key: value.value!,
            value: undefined
          };
        })
      };
    });
  };

  onDimensionValueChange = (dimensionIndex: number, value: SelectableValue<string>) => {
    this.setState(({ dimensions }) => {
      return {
        dimensions: dimensions.map((dimension, i) => {
          if (dimensionIndex !== i) {
            return dimension;
          }
          return {
            ...dimension,
            value: value.target.value!
          };
        })
      };
    }, this.updateSettings);
  };

  onOperatorChange = (dimensionIndex: number, value: SelectableValue<OperatorType>) => {
    this.setState(({ dimensions }) => {
      return {
        dimensions: dimensions.map((dimension, i) => {
          if (dimensionIndex !== i) {
            return dimension;
          }
          return {
            ...dimension,
            operator: value.value!
          };
        })
      };
    }, this.updateSettings);
  };

  render() {
    const { dimensions } = this.state;
    const label = this.props.label ?? "Dimension";
    return (
      <div className="gf-form-group">
        <div className="gf-form">
          <h6>{label}s</h6>
        </div>
        {dimensions.map((dimension, i) => (
          <InlineFieldRow>
            <InlineField label="Key" labelWidth={20} tooltip={'Start typing to query for keys'}>
              <AsyncSelect
                defaultOptions={true}
                value={{ label: dimension.key, value: dimension.key }}
                loadOptions={this.getDimensionKeys}
                isSearchable={true}
                width={25}
                onChange={(v) => {
                  this.onDimensionKeyChange(i, v);
                }}
              />
            </InlineField>

            <InlineField label="Operator" labelWidth={20}>
              <Select
                options={operatorTypeInfos}
                value={dimension.operator}
                width={25}
                onChange={(v) => {
                  this.onOperatorChange(i, v);
                }}
              />
            </InlineField>

            <InlineField label="Value" labelWidth={20}>
              <Input
                value={dimension.value}
                onChange={(v) => {
                  this.onDimensionValueChange(i, v);
                }}
                width={25}
              />
            </InlineField>
            <Button variant="secondary" size="xs" onClick={(_e) => this.onDimensionRemove(dimension.id)}>
              <Icon name="trash-alt" />
            </Button>
          </InlineFieldRow>
        ))}
        <div className="gf-form">
          <Button
            type="button"
            variant="secondary"
            icon="plus"
            onClick={(e) => {
              this.onDimensionAdd();
            }}
          >
            Add {label}
          </Button>
        </div>
      </div>
    );
  }
};

export default DimensionSettings;
