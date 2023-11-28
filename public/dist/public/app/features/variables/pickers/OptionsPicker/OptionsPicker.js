import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { LoadingState } from '@grafana/data';
import { ClickOutsideWrapper } from '@grafana/ui';
import { VARIABLE_PREFIX } from '../../constants';
import { isMulti } from '../../guard';
import { getVariableQueryRunner } from '../../query/VariableQueryRunner';
import { formatVariableLabel } from '../../shared/formatVariable';
import { toKeyedAction } from '../../state/keyedVariablesReducer';
import { getVariablesState } from '../../state/selectors';
import { toKeyedVariableIdentifier } from '../../utils';
import { VariableInput } from '../shared/VariableInput';
import { VariableLink } from '../shared/VariableLink';
import VariableOptions from '../shared/VariableOptions';
import { commitChangesToVariable, filterOrSearchOptions, navigateOptions, openOptions } from './actions';
import { initialOptionPickerState, toggleAllOptions, toggleOption } from './reducer';
export const optionPickerFactory = () => {
    const mapDispatchToProps = (dispatch) => {
        return Object.assign(Object.assign({}, bindActionCreators({ openOptions, commitChangesToVariable, navigateOptions }, dispatch)), { filterOrSearchOptions: (identifier, filter = '') => {
                dispatch(filterOrSearchOptions(identifier, filter));
            }, toggleAllOptions: (identifier) => dispatch(toKeyedAction(identifier.rootStateKey, toggleAllOptions())), toggleOption: (identifier, option, clearOthers, forceSelect) => dispatch(toKeyedAction(identifier.rootStateKey, toggleOption({ option, clearOthers, forceSelect }))) });
    };
    const mapStateToProps = (state, ownProps) => {
        const { rootStateKey } = ownProps.variable;
        if (!rootStateKey) {
            console.error('OptionPickerFactory: variable has no rootStateKey');
            return {
                picker: initialOptionPickerState,
            };
        }
        return {
            picker: getVariablesState(rootStateKey, state).optionsPicker,
        };
    };
    const connector = connect(mapStateToProps, mapDispatchToProps);
    class OptionsPickerUnconnected extends PureComponent {
        constructor() {
            super(...arguments);
            this.onShowOptions = () => this.props.openOptions(toKeyedVariableIdentifier(this.props.variable), this.props.onVariableChange);
            this.onHideOptions = () => {
                if (!this.props.variable.rootStateKey) {
                    console.error('Variable has no rootStateKey');
                    return;
                }
                this.props.commitChangesToVariable(this.props.variable.rootStateKey, this.props.onVariableChange);
            };
            this.onToggleOption = (option, clearOthers) => {
                const toggleFunc = isMulti(this.props.variable) && this.props.variable.multi
                    ? this.onToggleMultiValueVariable
                    : this.onToggleSingleValueVariable;
                toggleFunc(option, clearOthers);
            };
            this.onToggleSingleValueVariable = (option, clearOthers) => {
                this.props.toggleOption(toKeyedVariableIdentifier(this.props.variable), option, clearOthers, false);
                this.onHideOptions();
            };
            this.onToggleMultiValueVariable = (option, clearOthers) => {
                this.props.toggleOption(toKeyedVariableIdentifier(this.props.variable), option, clearOthers, false);
            };
            this.onToggleAllOptions = () => {
                this.props.toggleAllOptions(toKeyedVariableIdentifier(this.props.variable));
            };
            this.onFilterOrSearchOptions = (filter) => {
                this.props.filterOrSearchOptions(toKeyedVariableIdentifier(this.props.variable), filter);
            };
            this.onNavigate = (key, clearOthers) => {
                if (!this.props.variable.rootStateKey) {
                    console.error('Variable has no rootStateKey');
                    return;
                }
                this.props.navigateOptions(this.props.variable.rootStateKey, key, clearOthers);
            };
            this.onCancel = () => {
                getVariableQueryRunner().cancelRequest(toKeyedVariableIdentifier(this.props.variable));
            };
        }
        render() {
            const { variable, picker } = this.props;
            const showOptions = picker.id === variable.id;
            return (React.createElement("div", { className: "variable-link-wrapper" }, showOptions ? this.renderOptions(picker) : this.renderLink(variable)));
        }
        renderLink(variable) {
            const linkText = formatVariableLabel(variable);
            const loading = variable.state === LoadingState.Loading;
            return (React.createElement(VariableLink, { id: VARIABLE_PREFIX + variable.id, text: linkText, onClick: this.onShowOptions, loading: loading, onCancel: this.onCancel, disabled: this.props.readOnly }));
        }
        renderOptions(picker) {
            const { id } = this.props.variable;
            return (React.createElement(ClickOutsideWrapper, { onClick: this.onHideOptions },
                React.createElement(VariableInput, { id: VARIABLE_PREFIX + id, value: picker.queryValue, onChange: this.onFilterOrSearchOptions, onNavigate: this.onNavigate, "aria-expanded": true, "aria-controls": `options-${id}` }),
                React.createElement(VariableOptions, { values: picker.options, onToggle: this.onToggleOption, onToggleAll: this.onToggleAllOptions, highlightIndex: picker.highlightIndex, multi: picker.multi, selectedValues: picker.selectedValues, id: `options-${id}` })));
        }
    }
    const OptionsPicker = connector(OptionsPickerUnconnected);
    OptionsPicker.displayName = 'OptionsPicker';
    return OptionsPicker;
};
//# sourceMappingURL=OptionsPicker.js.map