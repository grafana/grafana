import React from 'react';
import _ from 'lodash';
import { DataSourceApi, DataQuery, DataSourceJsonData } from '@grafana/ui';
import { AdHocFilter } from './AdHocFilter';
export const DEFAULT_REMOVE_FILTER_VALUE = '-- remove filter --';

const addFilterButton = (onAddFilter: (event: React.MouseEvent) => void) => (
  <button className="gf-form-label gf-form-label--btn query-part" onClick={onAddFilter}>
    <i className="fa fa-plus" />
  </button>
);

export interface KeyValuePair {
  keys: string[];
  key: string;
  operator: string;
  value: string;
  values: string[];
}

export interface Props<TQuery extends DataQuery = DataQuery, TOptions extends DataSourceJsonData = DataSourceJsonData> {
  datasource: DataSourceApi<TQuery, TOptions>;
  onPairsChanged: (pairs: KeyValuePair[]) => void;
  extendedOptions?: any;
}

export interface State {
  pairs: KeyValuePair[];
}

export class AdHocFilterField<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends React.PureComponent<Props<TQuery, TOptions>, State> {
  state: State = { pairs: [] };

  componentDidUpdate(prevProps: Props) {
    if (_.isEqual(prevProps.extendedOptions, this.props.extendedOptions) === false) {
      const pairs = [];

      this.setState({ pairs }, () => this.props.onPairsChanged(pairs));
    }
  }

  loadTagKeys = async () => {
    const { datasource, extendedOptions } = this.props;
    const options = extendedOptions || {};
    const tagKeys = datasource.getTagKeys ? await datasource.getTagKeys(options) : [];
    const keys = tagKeys.map(tagKey => tagKey.text);

    return keys;
  };

  loadTagValues = async (key: string) => {
    const { datasource, extendedOptions } = this.props;
    const options = extendedOptions || {};
    const tagValues = datasource.getTagValues ? await datasource.getTagValues({ ...options, key }) : [];
    const values = tagValues.map(tagValue => tagValue.text);

    return values;
  };

  updatePairs(pairs: KeyValuePair[], index: number, pair: Partial<KeyValuePair>) {
    if (pairs.length === 0) {
      return [
        {
          key: pair.key || '',
          keys: pair.keys || [],
          operator: pair.operator || '',
          value: pair.value || '',
          values: pair.values || [],
        },
      ];
    }

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
  }

  onKeyChanged = (index: number) => async (key: string) => {
    if (key !== DEFAULT_REMOVE_FILTER_VALUE) {
      const { onPairsChanged } = this.props;
      const values = await this.loadTagValues(key);
      const pairs = this.updatePairs(this.state.pairs, index, { key, values });

      this.setState({ pairs }, () => onPairsChanged(pairs));
    } else {
      this.onRemoveFilter(index);
    }
  };

  onValueChanged = (index: number) => (value: string) => {
    const pairs = this.updatePairs(this.state.pairs, index, { value });

    this.setState({ pairs }, () => this.props.onPairsChanged(pairs));
  };

  onOperatorChanged = (index: number) => (operator: string) => {
    const pairs = this.updatePairs(this.state.pairs, index, { operator });

    this.setState({ pairs }, () => this.props.onPairsChanged(pairs));
  };

  onAddFilter = async () => {
    const keys = await this.loadTagKeys();
    const pairs = this.state.pairs.concat(this.updatePairs([], 0, { keys }));

    this.setState({ pairs }, () => this.props.onPairsChanged(pairs));
  };

  onRemoveFilter = async (index: number) => {
    const pairs = this.state.pairs.reduce((allPairs, pair, pairIndex) => {
      if (pairIndex === index) {
        return allPairs;
      }
      return allPairs.concat(pair);
    }, []);

    this.setState({ pairs });
  };

  render() {
    const { pairs } = this.state;
    return (
      <>
        {pairs.length < 1 && addFilterButton(this.onAddFilter)}
        {pairs.map((pair, index) => {
          const adHocKey = `adhoc-filter-${index}-${pair.key}-${pair.value}`;
          return (
            <div className="align-items-center flex-grow-1" key={adHocKey}>
              <AdHocFilter
                keys={[DEFAULT_REMOVE_FILTER_VALUE].concat(pair.keys)}
                values={pair.values}
                initialKey={pair.key}
                initialOperator={pair.operator}
                initialValue={pair.value}
                onKeyChanged={this.onKeyChanged(index)}
                onOperatorChanged={this.onOperatorChanged(index)}
                onValueChanged={this.onValueChanged(index)}
              />
              {index < pairs.length - 1 && <span>&nbsp;AND&nbsp;</span>}
              {index === pairs.length - 1 && addFilterButton(this.onAddFilter)}
            </div>
          );
        })}
      </>
    );
  }
}
