import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { AdHocVariableFilter, AdHocVariableModel } from 'app/features/variables/types';

import { VariablePickerProps } from '../../pickers/types';
import { toKeyedVariableIdentifier } from '../../utils';
import { addFilter, changeFilter, removeFilter } from '../actions';

import { AdHocFilter } from './AdHocFilter';

const mapDispatchToProps = {
  addFilter,
  removeFilter,
  changeFilter,
};

const connector = connect(null, mapDispatchToProps);

interface OwnProps extends VariablePickerProps<AdHocVariableModel> {}

type Props = OwnProps & ConnectedProps<typeof connector>;

/**
 * Thin wrapper over AdHocFilter to add redux actions and change the props so it can be used for ad hoc variable
 * control.
 */
export class AdHocPickerUnconnected extends PureComponent<Props> {
  addFilter = (filter: AdHocVariableFilter) => {
    this.props.addFilter(toKeyedVariableIdentifier(this.props.variable), filter);
  };

  removeFilter = (index: number) => {
    this.props.removeFilter(toKeyedVariableIdentifier(this.props.variable), index);
  };

  changeFilter = (index: number, filter: AdHocVariableFilter) => {
    this.props.changeFilter(toKeyedVariableIdentifier(this.props.variable), {
      index,
      filter,
    });
  };

  render() {
    const { filters, datasource } = this.props.variable;

    return (
      <AdHocFilter
        datasource={datasource}
        filters={filters}
        disabled={this.props.readOnly}
        addFilter={this.addFilter}
        removeFilter={this.removeFilter}
        changeFilter={this.changeFilter}
      />
    );
  }
}

export const AdHocPicker = connector(AdHocPickerUnconnected);
AdHocPicker.displayName = 'AdHocPicker';
