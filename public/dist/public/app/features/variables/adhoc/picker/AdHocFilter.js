import React, { PureComponent } from 'react';
import { Segment } from '@grafana/ui';
import { AdHocFilterBuilder } from './AdHocFilterBuilder';
import { REMOVE_FILTER_KEY } from './AdHocFilterKey';
import { AdHocFilterRenderer } from './AdHocFilterRenderer';
import { ConditionSegment } from './ConditionSegment';
/**
 * Simple filtering component that automatically uses datasource APIs to get available labels and its values, for
 * dynamic visual filtering without need for much setup. Instead of having single onChange prop this reports all the
 * change events with separate props so it is usable with AdHocPicker.
 *
 * Note: There isn't API on datasource to suggest the operators here so that is hardcoded to use prometheus style
 * operators. Also filters are assumed to be joined with `AND` operator, which is also hardcoded.
 */
export class AdHocFilter extends PureComponent {
    constructor() {
        super(...arguments);
        this.onChange = (index, prop) => (key) => {
            const { filters } = this.props;
            const { value } = key;
            if (key.value === REMOVE_FILTER_KEY) {
                return this.props.removeFilter(index);
            }
            return this.props.changeFilter(index, Object.assign(Object.assign({}, filters[index]), { [prop]: value }));
        };
        this.appendFilterToVariable = (filter) => {
            this.props.addFilter(filter);
        };
    }
    render() {
        const { filters, disabled } = this.props;
        return (React.createElement("div", { className: "gf-form-inline" },
            this.renderFilters(filters, disabled),
            !disabled && (React.createElement(AdHocFilterBuilder, { datasource: this.props.datasource, appendBefore: filters.length > 0 ? React.createElement(ConditionSegment, { label: "AND" }) : null, onCompleted: this.appendFilterToVariable, allFilters: this.getAllFilters() }))));
    }
    getAllFilters() {
        if (this.props.baseFilters) {
            return this.props.baseFilters.concat(this.props.filters);
        }
        return this.props.filters;
    }
    renderFilters(filters, disabled) {
        if (filters.length === 0 && disabled) {
            return React.createElement(Segment, { disabled: disabled, value: "No filters", options: [], onChange: () => { } });
        }
        return filters.reduce((segments, filter, index) => {
            if (segments.length > 0) {
                segments.push(React.createElement(ConditionSegment, { label: "AND", key: `condition-${index}` }));
            }
            segments.push(this.renderFilterSegments(filter, index, disabled));
            return segments;
        }, []);
    }
    renderFilterSegments(filter, index, disabled) {
        return (React.createElement(React.Fragment, { key: `filter-${index}` },
            React.createElement(AdHocFilterRenderer, { disabled: disabled, datasource: this.props.datasource, filter: filter, onKeyChange: this.onChange(index, 'key'), onOperatorChange: this.onChange(index, 'operator'), onValueChange: this.onChange(index, 'value'), allFilters: this.getAllFilters() })));
    }
}
//# sourceMappingURL=AdHocFilter.js.map