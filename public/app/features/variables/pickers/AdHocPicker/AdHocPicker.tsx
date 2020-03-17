import React, { PureComponent, ReactNode } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { StoreState } from 'app/types';
import { AdHocVariableModel, AdHocVariableFilter } from 'app/features/templating/variable';
import { SegmentAsync } from '@grafana/ui';
import { VariablePickerProps } from '../types';
import { OperatorSegment } from './OperatorSegment';
import { SelectableValue } from '@grafana/data';
import { AdHocFilterBuilder } from './AdHocFilterBuilder';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { ConditionSegment } from './ConditionSegment';
import { addFilter, removeFilter, changeFilter } from '../../adhoc/actions';

const REMOVE_FILTER_KEY = '-- remove filter --';

interface OwnProps extends VariablePickerProps<AdHocVariableModel> {}

interface ConnectedProps {}

interface DispatchProps {
  addFilter: typeof addFilter;
  removeFilter: typeof removeFilter;
  changeFilter: typeof changeFilter;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

const removeValue = { label: REMOVE_FILTER_KEY, value: REMOVE_FILTER_KEY };
export class AdHocPickerUnconnected extends PureComponent<Props> {
  onChange = (index: number, prop: string) => (key: SelectableValue<string>) => {
    const { uuid, filters } = this.props.variable;
    const { value } = key;

    if (key.value === REMOVE_FILTER_KEY) {
      return this.props.removeFilter(uuid, index);
    }

    return this.props.changeFilter(uuid, {
      index,
      filter: {
        ...filters[index],
        [prop]: value,
      },
    });
  };

  appendFilterToVariable = (filter: AdHocVariableFilter) => {
    const { uuid } = this.props.variable;
    this.props.addFilter(uuid, filter);
  };

  fetchFilterKeys = async () => {
    const { variable } = this.props;
    const ds = await getDatasourceSrv().get(variable.datasource);

    if (!ds || !ds.getTagKeys) {
      return [removeValue];
    }

    const metrics = await ds.getTagKeys();
    const values = metrics.map(m => ({ label: m.text, value: m.text }));

    return [removeValue, ...values];
  };

  fetchFilterValues = async (key: string) => {
    const { variable } = this.props;
    const ds = await getDatasourceSrv().get(variable.datasource);

    if (!ds || !ds.getTagValues) {
      return [];
    }

    const metrics = await ds.getTagValues({ key });
    return metrics.map(m => ({ label: m.text, value: m.text }));
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
      <>
        <div className="gf-form">
          <SegmentAsync
            className="query-segment-key"
            value={filter.key}
            onChange={this.onChange(index, 'key')}
            loadOptions={this.fetchFilterKeys}
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
      </>
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
