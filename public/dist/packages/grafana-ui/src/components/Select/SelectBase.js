import { __assign, __makeTemplateObject, __read, __spreadArray } from "tslib";
import React, { useCallback } from 'react';
import { default as ReactSelect } from 'react-select';
import Creatable from 'react-select/creatable';
import { default as ReactAsyncSelect } from 'react-select/async';
import { default as AsyncCreatable } from 'react-select/async-creatable';
import { Icon } from '../Icon/Icon';
import { Spinner } from '../Spinner/Spinner';
import { css, cx } from '@emotion/css';
import resetSelectStyles from './resetSelectStyles';
import { SelectMenu, SelectMenuOptions } from './SelectMenu';
import { IndicatorsContainer } from './IndicatorsContainer';
import { ValueContainer } from './ValueContainer';
import { InputControl } from './InputControl';
import { SelectContainer } from './SelectContainer';
import { DropdownIndicator } from './DropdownIndicator';
import { SelectOptionGroup } from './SelectOptionGroup';
import { SingleValue } from './SingleValue';
import { MultiValueContainer, MultiValueRemove } from './MultiValue';
import { useTheme2 } from '../../themes';
import { getSelectStyles } from './getSelectStyles';
import { cleanValue, findSelectedValue } from './utils';
import { deprecationWarning } from '@grafana/data';
var renderExtraValuesIndicator = function (props) {
    var maxVisibleValues = props.maxVisibleValues, selectedValuesCount = props.selectedValuesCount, menuIsOpen = props.menuIsOpen, showAllSelectedWhenOpen = props.showAllSelectedWhenOpen;
    if (maxVisibleValues !== undefined &&
        selectedValuesCount > maxVisibleValues &&
        !(showAllSelectedWhenOpen && menuIsOpen)) {
        return (React.createElement("span", { key: "excess-values", id: "excess-values" },
            "(+",
            selectedValuesCount - maxVisibleValues,
            ")"));
    }
    return null;
};
var CustomControl = function (props) {
    var children = props.children, innerProps = props.innerProps, _a = props.selectProps, menuIsOpen = _a.menuIsOpen, onMenuClose = _a.onMenuClose, onMenuOpen = _a.onMenuOpen, isFocused = props.isFocused, isMulti = props.isMulti, getValue = props.getValue, innerRef = props.innerRef;
    var selectProps = props.selectProps;
    if (selectProps.renderControl) {
        return React.createElement(selectProps.renderControl, {
            isOpen: menuIsOpen,
            value: isMulti ? getValue() : getValue()[0],
            ref: innerRef,
            onClick: menuIsOpen ? onMenuClose : onMenuOpen,
            onBlur: onMenuClose,
            disabled: !!selectProps.disabled,
            invalid: !!selectProps.invalid,
        });
    }
    return (React.createElement(InputControl, { ref: innerRef, innerProps: innerProps, prefix: selectProps.prefix, focused: isFocused, invalid: !!selectProps.invalid, disabled: !!selectProps.disabled }, children));
};
export function SelectBase(_a) {
    var _b = _a.allowCustomValue, allowCustomValue = _b === void 0 ? false : _b, _c = _a.allowCreateWhileLoading, allowCreateWhileLoading = _c === void 0 ? false : _c, ariaLabel = _a["aria-label"], _d = _a.autoFocus, autoFocus = _d === void 0 ? false : _d, _e = _a.backspaceRemovesValue, backspaceRemovesValue = _e === void 0 ? true : _e, cacheOptions = _a.cacheOptions, className = _a.className, _f = _a.closeMenuOnSelect, closeMenuOnSelect = _f === void 0 ? true : _f, components = _a.components, defaultOptions = _a.defaultOptions, defaultValue = _a.defaultValue, _g = _a.disabled, disabled = _g === void 0 ? false : _g, filterOption = _a.filterOption, formatCreateLabel = _a.formatCreateLabel, getOptionLabel = _a.getOptionLabel, getOptionValue = _a.getOptionValue, inputValue = _a.inputValue, invalid = _a.invalid, _h = _a.isClearable, isClearable = _h === void 0 ? false : _h, id = _a.id, _j = _a.isLoading, isLoading = _j === void 0 ? false : _j, _k = _a.isMulti, isMulti = _k === void 0 ? false : _k, inputId = _a.inputId, isOpen = _a.isOpen, isOptionDisabled = _a.isOptionDisabled, _l = _a.isSearchable, isSearchable = _l === void 0 ? true : _l, loadOptions = _a.loadOptions, _m = _a.loadingMessage, loadingMessage = _m === void 0 ? 'Loading options...' : _m, _o = _a.maxMenuHeight, maxMenuHeight = _o === void 0 ? 300 : _o, minMenuHeight = _a.minMenuHeight, maxVisibleValues = _a.maxVisibleValues, _p = _a.menuPlacement, menuPlacement = _p === void 0 ? 'auto' : _p, menuPosition = _a.menuPosition, _q = _a.menuShouldPortal, menuShouldPortal = _q === void 0 ? false : _q, _r = _a.noOptionsMessage, noOptionsMessage = _r === void 0 ? 'No options found' : _r, onBlur = _a.onBlur, onChange = _a.onChange, onCloseMenu = _a.onCloseMenu, onCreateOption = _a.onCreateOption, onInputChange = _a.onInputChange, onKeyDown = _a.onKeyDown, onOpenMenu = _a.onOpenMenu, _s = _a.openMenuOnFocus, openMenuOnFocus = _s === void 0 ? false : _s, _t = _a.options, options = _t === void 0 ? [] : _t, _u = _a.placeholder, placeholder = _u === void 0 ? 'Choose' : _u, prefix = _a.prefix, renderControl = _a.renderControl, _v = _a.showAllSelectedWhenOpen, showAllSelectedWhenOpen = _v === void 0 ? true : _v, _w = _a.tabSelectsValue, tabSelectsValue = _w === void 0 ? true : _w, value = _a.value, width = _a.width, isValidNewOption = _a.isValidNewOption;
    if (menuShouldPortal === false) {
        deprecationWarning('SelectBase', 'menuShouldPortal={false}', 'menuShouldPortal={true}');
    }
    var theme = useTheme2();
    var styles = getSelectStyles(theme);
    var onChangeWithEmpty = useCallback(function (value) {
        if (isMulti && (value === undefined || value === null)) {
            return onChange([]);
        }
        onChange(value);
    }, [isMulti, onChange]);
    var ReactSelectComponent = ReactSelect;
    var creatableProps = {};
    var asyncSelectProps = {};
    var selectedValue;
    if (isMulti && loadOptions) {
        selectedValue = value;
    }
    else {
        // If option is passed as a plain value (value property from SelectableValue property)
        // we are selecting the corresponding value from the options
        if (isMulti && value && Array.isArray(value) && !loadOptions) {
            // @ts-ignore
            selectedValue = value.map(function (v) { var _a; return findSelectedValue((_a = v.value) !== null && _a !== void 0 ? _a : v, options); });
        }
        else if (loadOptions) {
            var hasValue = defaultValue || value;
            selectedValue = hasValue ? [hasValue] : [];
        }
        else {
            selectedValue = cleanValue(value, options);
        }
    }
    var commonSelectProps = {
        'aria-label': ariaLabel,
        autoFocus: autoFocus,
        backspaceRemovesValue: backspaceRemovesValue,
        captureMenuScroll: false,
        closeMenuOnSelect: closeMenuOnSelect,
        // We don't want to close if we're actually scrolling the menu
        // So only close if none of the parents are the select menu itself
        defaultValue: defaultValue,
        // Also passing disabled, as this is the new Select API, and I want to use this prop instead of react-select's one
        disabled: disabled,
        filterOption: filterOption,
        getOptionLabel: getOptionLabel,
        getOptionValue: getOptionValue,
        inputValue: inputValue,
        invalid: invalid,
        isClearable: isClearable,
        id: id,
        // Passing isDisabled as react-select accepts this prop
        isDisabled: disabled,
        isLoading: isLoading,
        isMulti: isMulti,
        inputId: inputId,
        isOptionDisabled: isOptionDisabled,
        isSearchable: isSearchable,
        maxMenuHeight: maxMenuHeight,
        minMenuHeight: minMenuHeight,
        maxVisibleValues: maxVisibleValues,
        menuIsOpen: isOpen,
        menuPlacement: menuPlacement,
        menuPosition: menuPosition,
        menuShouldBlockScroll: true,
        menuPortalTarget: menuShouldPortal ? document.body : undefined,
        menuShouldScrollIntoView: false,
        onBlur: onBlur,
        onChange: onChangeWithEmpty,
        onInputChange: onInputChange,
        onKeyDown: onKeyDown,
        onMenuClose: onCloseMenu,
        onMenuOpen: onOpenMenu,
        openMenuOnFocus: openMenuOnFocus,
        options: options,
        placeholder: placeholder,
        prefix: prefix,
        renderControl: renderControl,
        showAllSelectedWhenOpen: showAllSelectedWhenOpen,
        tabSelectsValue: tabSelectsValue,
        value: isMulti ? selectedValue : selectedValue === null || selectedValue === void 0 ? void 0 : selectedValue[0],
    };
    if (allowCustomValue) {
        ReactSelectComponent = Creatable;
        creatableProps.allowCreateWhileLoading = allowCreateWhileLoading;
        creatableProps.formatCreateLabel = formatCreateLabel !== null && formatCreateLabel !== void 0 ? formatCreateLabel : (function (input) { return "Create: " + input; });
        creatableProps.onCreateOption = onCreateOption;
        creatableProps.isValidNewOption = isValidNewOption;
    }
    // Instead of having AsyncSelect, as a separate component we render ReactAsyncSelect
    if (loadOptions) {
        ReactSelectComponent = (allowCustomValue ? AsyncCreatable : ReactAsyncSelect);
        asyncSelectProps = {
            loadOptions: loadOptions,
            cacheOptions: cacheOptions,
            defaultOptions: defaultOptions,
        };
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(ReactSelectComponent, __assign({ components: __assign({ MenuList: SelectMenu, Group: SelectOptionGroup, ValueContainer: ValueContainer, Placeholder: function (props) {
                    return (React.createElement("div", __assign({}, props.innerProps, { className: cx(css(props.getStyles('placeholder', props)), css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n                    display: inline-block;\n                    color: ", ";\n                    position: absolute;\n                    top: 50%;\n                    transform: translateY(-50%);\n                    box-sizing: border-box;\n                    line-height: 1;\n                    white-space: nowrap;\n                  "], ["\n                    display: inline-block;\n                    color: ", ";\n                    position: absolute;\n                    top: 50%;\n                    transform: translateY(-50%);\n                    box-sizing: border-box;\n                    line-height: 1;\n                    white-space: nowrap;\n                  "])), theme.colors.text.disabled)) }), props.children));
                }, IndicatorsContainer: function (props) {
                    var selectProps = props.selectProps;
                    var value = selectProps.value, showAllSelectedWhenOpen = selectProps.showAllSelectedWhenOpen, maxVisibleValues = selectProps.maxVisibleValues, menuIsOpen = selectProps.menuIsOpen;
                    if (maxVisibleValues !== undefined) {
                        var selectedValuesCount = value.length;
                        var indicatorChildren = __spreadArray([], __read(props.children), false);
                        indicatorChildren.splice(-1, 0, renderExtraValuesIndicator({
                            maxVisibleValues: maxVisibleValues,
                            selectedValuesCount: selectedValuesCount,
                            showAllSelectedWhenOpen: showAllSelectedWhenOpen,
                            menuIsOpen: menuIsOpen,
                        }));
                        return React.createElement(IndicatorsContainer, __assign({}, props), indicatorChildren);
                    }
                    return React.createElement(IndicatorsContainer, __assign({}, props));
                }, IndicatorSeparator: function () {
                    return React.createElement(React.Fragment, null);
                }, Control: CustomControl, Option: SelectMenuOptions, ClearIndicator: function (props) {
                    var clearValue = props.clearValue;
                    return (React.createElement(Icon, { name: "times", role: "button", "aria-label": "select-clear-value", className: styles.singleValueRemove, onMouseDown: function (e) {
                            e.preventDefault();
                            e.stopPropagation();
                            clearValue();
                        } }));
                }, LoadingIndicator: function (props) {
                    return React.createElement(Spinner, { inline: true });
                }, LoadingMessage: function (props) {
                    return React.createElement("div", { className: styles.loadingMessage }, loadingMessage);
                }, NoOptionsMessage: function (props) {
                    return (React.createElement("div", { className: styles.loadingMessage, "aria-label": "No options provided" }, noOptionsMessage));
                }, DropdownIndicator: function (props) {
                    return React.createElement(DropdownIndicator, { isOpen: props.selectProps.menuIsOpen });
                }, SingleValue: function (props) {
                    return React.createElement(SingleValue, __assign({}, props, { disabled: disabled }));
                }, MultiValueContainer: MultiValueContainer, MultiValueRemove: MultiValueRemove, SelectContainer: SelectContainer }, components), styles: __assign(__assign({}, resetSelectStyles()), { menuPortal: function (base) { return (__assign(__assign({}, base), { zIndex: theme.zIndex.portal })); }, 
                //These are required for the menu positioning to function
                menu: function (_a) {
                    var top = _a.top, bottom = _a.bottom, position = _a.position;
                    return ({
                        top: top,
                        bottom: bottom,
                        position: position,
                        minWidth: '100%',
                        zIndex: theme.zIndex.dropdown,
                    });
                }, container: function () { return ({
                    position: 'relative',
                    width: width ? 8 * width + "px" : '100%',
                }); }, option: function (provided, state) { return (__assign(__assign({}, provided), { opacity: state.isDisabled ? 0.5 : 1 })); } }), className: className }, commonSelectProps, creatableProps, asyncSelectProps))));
}
var templateObject_1;
//# sourceMappingURL=SelectBase.js.map