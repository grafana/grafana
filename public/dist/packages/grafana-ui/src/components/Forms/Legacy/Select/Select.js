import { __assign, __extends } from "tslib";
// Libraries
import classNames from 'classnames';
import React, { PureComponent } from 'react';
import { default as ReactSelect, components } from 'react-select';
import Creatable from 'react-select/creatable';
import { default as ReactAsyncSelect } from 'react-select/async';
// Components
import { SelectOption } from './SelectOption';
import { SelectOptionGroup } from '../../../Select/SelectOptionGroup';
import { SingleValue } from '../../../Select/SingleValue';
import IndicatorsContainer from './IndicatorsContainer';
import NoOptionsMessage from './NoOptionsMessage';
import resetSelectStyles from '../../../Select/resetSelectStyles';
import { CustomScrollbar } from '../../../CustomScrollbar/CustomScrollbar';
import { Tooltip } from '../../../Tooltip/Tooltip';
export var MenuList = function (props) {
    return (React.createElement(components.MenuList, __assign({}, props),
        React.createElement(CustomScrollbar, { autoHide: false, autoHeightMax: "inherit" }, props.children)));
};
var Select = /** @class */ (function (_super) {
    __extends(Select, _super);
    function Select() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Select.prototype.render = function () {
        var _a = this.props, defaultValue = _a.defaultValue, getOptionLabel = _a.getOptionLabel, getOptionValue = _a.getOptionValue, onChange = _a.onChange, options = _a.options, placeholder = _a.placeholder, width = _a.width, value = _a.value, className = _a.className, isDisabled = _a.isDisabled, isLoading = _a.isLoading, isSearchable = _a.isSearchable, isClearable = _a.isClearable, backspaceRemovesValue = _a.backspaceRemovesValue, isMulti = _a.isMulti, autoFocus = _a.autoFocus, openMenuOnFocus = _a.openMenuOnFocus, onBlur = _a.onBlur, maxMenuHeight = _a.maxMenuHeight, noOptionsMessage = _a.noOptionsMessage, isOpen = _a.isOpen, components = _a.components, tooltipContent = _a.tooltipContent, tabSelectsValue = _a.tabSelectsValue, onCloseMenu = _a.onCloseMenu, onOpenMenu = _a.onOpenMenu, allowCustomValue = _a.allowCustomValue, formatCreateLabel = _a.formatCreateLabel;
        var widthClass = '';
        if (width) {
            widthClass = 'width-' + width;
        }
        var SelectComponent = ReactSelect;
        var creatableOptions = {};
        if (allowCustomValue) {
            SelectComponent = Creatable;
            creatableOptions.formatCreateLabel = formatCreateLabel !== null && formatCreateLabel !== void 0 ? formatCreateLabel : (function (input) { return input; });
        }
        var selectClassNames = classNames('gf-form-input', 'gf-form-input--form-dropdown', widthClass, className);
        var selectComponents = __assign(__assign({}, Select.defaultProps.components), components);
        return (React.createElement(WrapInTooltip, { onCloseMenu: onCloseMenu, onOpenMenu: onOpenMenu, tooltipContent: tooltipContent, isOpen: isOpen }, function (onOpenMenuInternal, onCloseMenuInternal) {
            return (React.createElement(SelectComponent, __assign({ captureMenuScroll: false, classNamePrefix: "gf-form-select-box", className: selectClassNames, components: selectComponents, defaultValue: defaultValue, value: value, getOptionLabel: getOptionLabel, getOptionValue: getOptionValue, menuShouldScrollIntoView: false, isSearchable: isSearchable, onChange: onChange, options: options, placeholder: placeholder || 'Choose', styles: resetSelectStyles(), isDisabled: isDisabled, isLoading: isLoading, isClearable: isClearable, autoFocus: autoFocus, onBlur: onBlur, openMenuOnFocus: openMenuOnFocus, maxMenuHeight: maxMenuHeight, noOptionsMessage: noOptionsMessage, isMulti: isMulti, backspaceRemovesValue: backspaceRemovesValue, menuIsOpen: isOpen, onMenuOpen: onOpenMenuInternal, onMenuClose: onCloseMenuInternal, tabSelectsValue: tabSelectsValue }, creatableOptions)));
        }));
    };
    Select.defaultProps = {
        className: '',
        isDisabled: false,
        isSearchable: true,
        isClearable: false,
        isMulti: false,
        openMenuOnFocus: false,
        autoFocus: false,
        isLoading: false,
        backspaceRemovesValue: true,
        maxMenuHeight: 300,
        tabSelectsValue: true,
        allowCustomValue: false,
        components: {
            Option: SelectOption,
            SingleValue: SingleValue,
            IndicatorsContainer: IndicatorsContainer,
            MenuList: MenuList,
            Group: SelectOptionGroup,
        },
    };
    return Select;
}(PureComponent));
export { Select };
var AsyncSelect = /** @class */ (function (_super) {
    __extends(AsyncSelect, _super);
    function AsyncSelect() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AsyncSelect.prototype.render = function () {
        var _a = this.props, defaultValue = _a.defaultValue, getOptionLabel = _a.getOptionLabel, getOptionValue = _a.getOptionValue, onChange = _a.onChange, placeholder = _a.placeholder, width = _a.width, value = _a.value, className = _a.className, loadOptions = _a.loadOptions, defaultOptions = _a.defaultOptions, isLoading = _a.isLoading, loadingMessage = _a.loadingMessage, noOptionsMessage = _a.noOptionsMessage, isDisabled = _a.isDisabled, isSearchable = _a.isSearchable, isClearable = _a.isClearable, backspaceRemovesValue = _a.backspaceRemovesValue, autoFocus = _a.autoFocus, onBlur = _a.onBlur, openMenuOnFocus = _a.openMenuOnFocus, maxMenuHeight = _a.maxMenuHeight, isMulti = _a.isMulti, tooltipContent = _a.tooltipContent, onCloseMenu = _a.onCloseMenu, onOpenMenu = _a.onOpenMenu, isOpen = _a.isOpen;
        var widthClass = '';
        if (width) {
            widthClass = 'width-' + width;
        }
        var selectClassNames = classNames('gf-form-input', 'gf-form-input--form-dropdown', widthClass, className);
        return (React.createElement(WrapInTooltip, { onCloseMenu: onCloseMenu, onOpenMenu: onOpenMenu, tooltipContent: tooltipContent, isOpen: isOpen }, function (onOpenMenuInternal, onCloseMenuInternal) {
            return (
            //@ts-expect-error
            React.createElement(ReactAsyncSelect, { captureMenuScroll: false, classNamePrefix: "gf-form-select-box", className: selectClassNames, components: {
                    Option: SelectOption,
                    SingleValue: SingleValue,
                    IndicatorsContainer: IndicatorsContainer,
                    NoOptionsMessage: NoOptionsMessage,
                }, defaultValue: defaultValue, value: value, getOptionLabel: getOptionLabel, getOptionValue: getOptionValue, menuShouldScrollIntoView: false, onChange: onChange, loadOptions: loadOptions, isLoading: isLoading, defaultOptions: defaultOptions, placeholder: placeholder || 'Choose', styles: resetSelectStyles(), loadingMessage: function () { return loadingMessage; }, noOptionsMessage: noOptionsMessage, isDisabled: isDisabled, isSearchable: isSearchable, isClearable: isClearable, autoFocus: autoFocus, onBlur: onBlur, openMenuOnFocus: openMenuOnFocus, maxMenuHeight: maxMenuHeight, isMulti: isMulti, backspaceRemovesValue: backspaceRemovesValue }));
        }));
    };
    AsyncSelect.defaultProps = {
        className: '',
        components: {},
        loadingMessage: function () { return 'Loading...'; },
        isDisabled: false,
        isClearable: false,
        isMulti: false,
        isSearchable: true,
        backspaceRemovesValue: true,
        autoFocus: false,
        openMenuOnFocus: false,
        maxMenuHeight: 300,
    };
    return AsyncSelect;
}(PureComponent));
export { AsyncSelect };
var WrapInTooltip = /** @class */ (function (_super) {
    __extends(WrapInTooltip, _super);
    function WrapInTooltip() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            isOpenInternal: false,
        };
        _this.onOpenMenu = function () {
            var onOpenMenu = _this.props.onOpenMenu;
            if (onOpenMenu) {
                onOpenMenu();
            }
            _this.setState({ isOpenInternal: true });
        };
        _this.onCloseMenu = function () {
            var onCloseMenu = _this.props.onCloseMenu;
            if (onCloseMenu) {
                onCloseMenu();
            }
            _this.setState({ isOpenInternal: false });
        };
        return _this;
    }
    WrapInTooltip.prototype.render = function () {
        var _a = this.props, children = _a.children, isOpen = _a.isOpen, tooltipContent = _a.tooltipContent;
        var isOpenInternal = this.state.isOpenInternal;
        var showTooltip = undefined;
        if (isOpenInternal || isOpen) {
            showTooltip = false;
        }
        if (tooltipContent) {
            return (React.createElement(Tooltip, { show: showTooltip, content: tooltipContent, placement: "bottom" },
                React.createElement("div", null, children(this.onOpenMenu, this.onCloseMenu))));
        }
        else {
            return React.createElement("div", null, children(this.onOpenMenu, this.onCloseMenu));
        }
    };
    return WrapInTooltip;
}(PureComponent));
export { WrapInTooltip };
export default Select;
//# sourceMappingURL=Select.js.map