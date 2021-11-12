import React, { PureComponent, ReactNode } from 'react';
import { AdHocVariableFilter } from 'app/features/variables/types';
import { DataSourceRef, SelectableValue } from '@grafana/data';
import { AdHocFilterBuilder } from './AdHocFilterBuilder';
import { ConditionSegment } from './ConditionSegment';
import { REMOVE_FILTER_KEY } from './AdHocFilterKey';
import { AdHocFilterRenderer } from './AdHocFilterRenderer';

interface Props {
  datasource: DataSourceRef | null;
  filters: AdHocVariableFilter[];
  addFilter: (filter: AdHocVariableFilter) => void;
  removeFilter: (index: number) => void;
  changeFilter: (index: number, newFilter: AdHocVariableFilter) => void;
}

/**
 * Simple filtering component that automatically uses datasource APIs to get available labels and it's values, for
 * dynamic visual filtering without need for much setup. Instead of having single onChange prop this reports all the
 * change events with separate props so it is usable with AdHocPicker.
 *
 * Note: There isn't API on datasource to suggest the operators here so that is hardcoded to use prometheus style
 * operators. Also filters are assumed to be joined with `AND` operator, which is also hardcoded.
 */
export class AdHocFilter extends PureComponent<Props> {
  onChange = (index: number, prop: string) => (key: SelectableValue<string | null>) => {
    const { filters } = this.props;
    const { value } = key;

    if (key.value === REMOVE_FILTER_KEY) {
      return this.props.removeFilter(index);
    }

    return this.props.changeFilter(index, {
      ...filters[index],
      [prop]: value,
    });
  };

  appendFilterToVariable = (filter: AdHocVariableFilter) => {
    this.props.addFilter(filter);
  };

  render() {
    const { filters } = this.props;

    return (
      <div className="gf-form-inline">
        {this.renderFilters(filters)}
        <AdHocFilterBuilder
          datasource={this.props.datasource!}
          appendBefore={filters.length > 0 ? <ConditionSegment label="AND" /> : null}
          onCompleted={this.appendFilterToVariable}
        />
      </div>
    );
  }

  renderFilters(filters: AdHocVariableFilter[]) {
    return filters.reduce((segments: ReactNode[], filter, index) => {
      if (segments.length > 0) {
        segments.push(<ConditionSegment label="AND" key={`condition-${index}`} />);
      }
      segments.push(this.renderFilterSegments(filter, index));
      return segments;
    }, []);
  }

  renderFilterSegments(filter: AdHocVariableFilter, index: number) {
    return (
      <React.Fragment key={`filter-${index}`}>
        <AdHocFilterRenderer
          datasource={this.props.datasource!}
          filter={filter}
          onKeyChange={this.onChange(index, 'key')}
          onOperatorChange={this.onChange(index, 'operator')}
          onValueChange={this.onChange(index, 'value')}
        />
      </React.Fragment>
    );
  }
}
