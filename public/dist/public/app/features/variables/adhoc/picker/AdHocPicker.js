import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { toKeyedVariableIdentifier } from '../../utils';
import { addFilter, changeFilter, removeFilter } from '../actions';
import { AdHocFilter } from './AdHocFilter';
const mapDispatchToProps = {
    addFilter,
    removeFilter,
    changeFilter,
};
const connector = connect(null, mapDispatchToProps);
/**
 * Thin wrapper over AdHocFilter to add redux actions and change the props so it can be used for ad hoc variable
 * control.
 */
export class AdHocPickerUnconnected extends PureComponent {
    constructor() {
        super(...arguments);
        this.addFilter = (filter) => {
            this.props.addFilter(toKeyedVariableIdentifier(this.props.variable), filter);
        };
        this.removeFilter = (index) => {
            this.props.removeFilter(toKeyedVariableIdentifier(this.props.variable), index);
        };
        this.changeFilter = (index, filter) => {
            this.props.changeFilter(toKeyedVariableIdentifier(this.props.variable), {
                index,
                filter,
            });
        };
    }
    render() {
        const { filters, datasource, baseFilters } = this.props.variable;
        return (React.createElement(AdHocFilter, { datasource: datasource, filters: filters, baseFilters: baseFilters, disabled: this.props.readOnly, addFilter: this.addFilter, removeFilter: this.removeFilter, changeFilter: this.changeFilter }));
    }
}
export const AdHocPicker = connector(AdHocPickerUnconnected);
AdHocPicker.displayName = 'AdHocPicker';
//# sourceMappingURL=AdHocPicker.js.map