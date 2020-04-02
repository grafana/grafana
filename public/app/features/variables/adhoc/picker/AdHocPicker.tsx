import React, { PureComponent, ReactNode } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { StoreState } from 'app/types';
import { AdHocVariableFilter, AdHocVariableModel } from 'app/features/templating/types';
import { SegmentAsync } from '@grafana/ui';
import { VariablePickerProps } from '../../pickers/types';
import { OperatorSegment } from './OperatorSegment';
import { MetricFindValue, SelectableValue } from '@grafana/data';
import { AdHocFilterBuilder } from './AdHocFilterBuilder';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { ConditionSegment } from './ConditionSegment';
import { addFilter, changeFilter, removeFilter } from '../actions';

interface OwnProps extends VariablePickerProps<AdHocVariableModel> {}

interface ConnectedProps {}

interface DispatchProps {
  addFilter: typeof addFilter;
  removeFilter: typeof removeFilter;
  changeFilter: typeof changeFilter;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

const REMOVE_FILTER_KEY = '-- remove filter --';
const REMOVE_VALUE = { label: REMOVE_FILTER_KEY, value: REMOVE_FILTER_KEY };
export class AdHocPickerUnconnected extends PureComponent<Props> {
  onChange = (index: number, prop: string) => (key: SelectableValue<string>) => {
    const { id, filters } = this.props.variable;
    const { value } = key;

    if (key.value === REMOVE_FILTER_KEY) {
      return this.props.removeFilter(id!, index);
    }

    return this.props.changeFilter(id!, {
      index,
      filter: {
        ...filters[index],
        [prop]: value,
      },
    });
  };

  appendFilterToVariable = (filter: AdHocVariableFilter) => {
    const { id } = this.props.variable;
    this.props.addFilter(id!, filter);
  };

  fetchFilterKeys = async () => {
    const { variable } = this.props;
    const ds = await getDatasourceSrv().get(variable.datasource!);

    if (!ds || !ds.getTagKeys) {
      return [];
    }

    const metrics = await ds.getTagKeys();
    return metrics.map(m => ({ label: m.text, value: m.text }));
  };

  fetchFilterKeysWithRemove = async () => {
    const keys = await this.fetchFilterKeys();
    return [REMOVE_VALUE, ...keys];
  };

  fetchFilterValues = async (key: string) => {
    const { variable } = this.props;
    const ds = await getDatasourceSrv().get(variable.datasource!);

    if (!ds || !ds.getTagValues) {
      return [];
    }

    const metrics = await ds.getTagValues({ key });
    return metrics.map((m: MetricFindValue) => ({ label: m.text, value: m.text }));
  };

  render() {
    const { filters } = this.props.variable;

    return (
      <div className="gf-form-inline">
        {this.renderFilters(filters)}
        <AdHocFilterBuilder
          appendBefore={filters.length > 0 ? <ConditionSegment label="AND" /> : null}
          onLoadKeys={this.fetchFilterKeys}
          onLoadValues={this.fetchFilterValues}
          onCompleted={this.appendFilterToVariable}
        />
      </div>
    );
  }

  renderFilters(filters: AdHocVariableFilter[]) {
    return filters.reduce((segments: ReactNode[], filter, index) => {
      if (segments.length > 0) {
        segments.push(<ConditionSegment label="AND" />);
      }
      segments.push(this.renderFilterSegments(filter, index));
      return segments;
    }, []);
  }

  renderFilterSegments(filter: AdHocVariableFilter, index: number) {
    return (
      <React.Fragment key={`filter-${index}`}>
        <div className="gf-form">
          <SegmentAsync
            className="query-segment-key"
            value={filter.key}
            onChange={this.onChange(index, 'key')}
            loadOptions={this.fetchFilterKeysWithRemove}
          />
        </div>
        <div className="gf-form">
          <OperatorSegment value={filter.operator} onChange={this.onChange(index, 'operator')} />
        </div>
        <div className="gf-form">
          <SegmentAsync
            className="query-segment-value"
            value={filter.value}
            onChange={this.onChange(index, 'value')}
            loadOptions={() => this.fetchFilterValues(filter.key)}
          />
        </div>
      </React.Fragment>
    );
  }
}

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  addFilter,
  removeFilter,
  changeFilter,
};

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = state => ({});

export const AdHocPicker = connect(mapStateToProps, mapDispatchToProps)(AdHocPickerUnconnected);
AdHocPicker.displayName = 'AdHocPicker';
