import React from 'react';
import { DataSourceApi, DataQuery, DataSourceJsonData, ExploreQueryFieldProps } from '@grafana/ui';
import { KeyValue } from './KeyValue';

export interface KeyValuePair {
  keys: string[];
  key: string;
  operator: string;
  value: string;
  values: string[];
}

export interface Props<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends ExploreQueryFieldProps<DSType, TQuery, TOptions> {}

export interface State {
  pairs: KeyValuePair[];
}

export class AdHocFilterField<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends React.PureComponent<Props<DSType, TQuery, TOptions>, State> {
  state: State = { pairs: [] };

  async componentDidMount() {
    const tagKeys = this.props.datasource.getTagKeys ? await this.props.datasource.getTagKeys({}) : [];
    const keys = tagKeys.map(tagKey => tagKey.text);
    const pairs = [{ key: null, operator: null, value: null, keys, values: [] }];
    this.setState({ pairs });
  }

  updatePairAt = (index: number, pair: Partial<KeyValuePair>) => {
    const { pairs } = this.state;
    const newPairs: KeyValuePair[] = [];
    for (let pairIndex = 0; pairIndex < pairs.length; pairIndex++) {
      const newPair = pairs[pairIndex];
      if (index === pairIndex) {
        newPairs.push({
          ...newPair,
          key: pair.key || newPair.key,
          value: pair.value || newPair.value,
          operator: pair.operator || newPair.operator,
          keys: pair.keys || newPair.keys,
          values: pair.values || newPair.values,
        });
        continue;
      }

      newPairs.push(newPair);
    }

    return newPairs;
  };

  onKeyChanged = (index: number) => async (key: string) => {
    const { datasource } = this.props;
    const tagValues = datasource.getTagValues ? await datasource.getTagValues({ key }) : [];
    const values = tagValues.map(tagValue => tagValue.text);
    const newPairs = this.updatePairAt(index, { key, values });

    this.setState({ pairs: newPairs });
    this.props.onRunQuery();
  };

  onValueChanged = (index: number) => (value: string) => {
    const newPairs = this.updatePairAt(index, { value });

    this.setState({ pairs: newPairs });
    this.props.onRunQuery();
  };

  onOperatorChanged = (index: number) => (operator: string) => {
    const newPairs = this.updatePairAt(index, { operator });

    this.setState({ pairs: newPairs });
    this.props.onRunQuery();
  };

  render() {
    const { pairs } = this.state;
    return (
      <>
        {pairs.map((pair, index) => (
          <KeyValue
            key={`key-value-${pair.key}-${pair.value}`}
            keys={pair.keys}
            values={pair.values}
            initialKey={pair.key}
            initialOperator={pair.operator}
            initialValue={pair.value}
            onKeyChanged={this.onKeyChanged(index)}
            onOperatorChanged={this.onOperatorChanged(index)}
            onValueChanged={this.onValueChanged(index)}
          />
        ))}
      </>
    );
  }
}
