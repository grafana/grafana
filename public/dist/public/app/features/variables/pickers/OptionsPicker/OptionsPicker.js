import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { ClickOutsideWrapper } from '@grafana/ui';
import { LoadingState } from '@grafana/data';
import { VariableInput } from '../shared/VariableInput';
import { commitChangesToVariable, filterOrSearchOptions, navigateOptions, openOptions } from './actions';
import { toggleAllOptions, toggleOption } from './reducer';
import { VariableOptions } from '../shared/VariableOptions';
import { isMulti } from '../../guard';
import { formatVariableLabel } from '../../shared/formatVariable';
import { toVariableIdentifier } from '../../state/types';
import { getVariableQueryRunner } from '../../query/VariableQueryRunner';
import { VariableLink } from '../shared/VariableLink';
export var optionPickerFactory = function () {
    var mapDispatchToProps = {
        openOptions: openOptions,
        commitChangesToVariable: commitChangesToVariable,
        filterOrSearchOptions: filterOrSearchOptions,
        toggleAllOptions: toggleAllOptions,
        toggleOption: toggleOption,
        navigateOptions: navigateOptions,
    };
    var mapStateToProps = function (state) { return ({
        picker: state.templating.optionsPicker,
    }); };
    var connector = connect(mapStateToProps, mapDispatchToProps);
    var OptionsPickerUnconnected = /** @class */ (function (_super) {
        __extends(OptionsPickerUnconnected, _super);
        function OptionsPickerUnconnected() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.onShowOptions = function () {
                return _this.props.openOptions(toVariableIdentifier(_this.props.variable), _this.props.onVariableChange);
            };
            _this.onHideOptions = function () { return _this.props.commitChangesToVariable(_this.props.onVariableChange); };
            _this.onToggleOption = function (option, clearOthers) {
                var toggleFunc = isMulti(_this.props.variable) && _this.props.variable.multi
                    ? _this.onToggleMultiValueVariable
                    : _this.onToggleSingleValueVariable;
                toggleFunc(option, clearOthers);
            };
            _this.onToggleSingleValueVariable = function (option, clearOthers) {
                _this.props.toggleOption({ option: option, clearOthers: clearOthers, forceSelect: false });
                _this.onHideOptions();
            };
            _this.onToggleMultiValueVariable = function (option, clearOthers) {
                _this.props.toggleOption({ option: option, clearOthers: clearOthers, forceSelect: false });
            };
            _this.onCancel = function () {
                getVariableQueryRunner().cancelRequest(toVariableIdentifier(_this.props.variable));
            };
            return _this;
        }
        OptionsPickerUnconnected.prototype.render = function () {
            var _a = this.props, variable = _a.variable, picker = _a.picker;
            var showOptions = picker.id === variable.id;
            return (React.createElement("div", { className: "variable-link-wrapper" }, showOptions ? this.renderOptions(picker) : this.renderLink(variable)));
        };
        OptionsPickerUnconnected.prototype.renderLink = function (variable) {
            var linkText = formatVariableLabel(variable);
            var loading = variable.state === LoadingState.Loading;
            return (React.createElement(VariableLink, { id: variable.id, text: linkText, onClick: this.onShowOptions, loading: loading, onCancel: this.onCancel }));
        };
        OptionsPickerUnconnected.prototype.renderOptions = function (picker) {
            var id = this.props.variable.id;
            return (React.createElement(ClickOutsideWrapper, { onClick: this.onHideOptions },
                React.createElement(VariableInput, { id: id, value: picker.queryValue, onChange: this.props.filterOrSearchOptions, onNavigate: this.props.navigateOptions, "aria-expanded": true, "aria-controls": "options-" + id }),
                React.createElement(VariableOptions, { values: picker.options, onToggle: this.onToggleOption, onToggleAll: this.props.toggleAllOptions, highlightIndex: picker.highlightIndex, multi: picker.multi, selectedValues: picker.selectedValues, id: "options-" + id })));
        };
        return OptionsPickerUnconnected;
    }(PureComponent));
    var OptionsPicker = connector(OptionsPickerUnconnected);
    OptionsPicker.displayName = 'OptionsPicker';
    return OptionsPicker;
};
//# sourceMappingURL=OptionsPicker.js.map