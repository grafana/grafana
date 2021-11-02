import { __read } from "tslib";
import React, { useState, useEffect } from 'react';
import debouncePromise from 'debounce-promise';
import { cx, css } from '@emotion/css';
import { useAsyncFn } from 'react-use';
import { InlineLabel, Select, AsyncSelect, Input } from '@grafana/ui';
import { useShadowedState } from '../useShadowedState';
var selectClass = css({
    minWidth: '160px',
});
// when a custom value is written into a select-box,
// by default the new value is prefixed with "Create:",
// and that sounds confusing because here we do not create
// anything. we change this to just be the entered string.
var formatCreateLabel = function (v) { return v; };
var SelReload = function (_a) {
    var loadOptions = _a.loadOptions, allowCustomValue = _a.allowCustomValue, onChange = _a.onChange, onClose = _a.onClose;
    // here we rely on the fact that writing text into the <AsyncSelect/>
    // does not cause a re-render of the current react component.
    // this way there is only a single render-call,
    // so there is only a single `debouncedLoadOptions`.
    // if we want ot make this "re-render safe,
    // we will have to put the debounced call into an useRef,
    // and probably have an useEffect
    var debouncedLoadOptions = debouncePromise(loadOptions, 1000, { leading: true });
    return (React.createElement("div", { className: selectClass },
        React.createElement(AsyncSelect, { menuShouldPortal: true, formatCreateLabel: formatCreateLabel, defaultOptions: true, autoFocus: true, isOpen: true, onCloseMenu: onClose, allowCustomValue: allowCustomValue, loadOptions: debouncedLoadOptions, onChange: onChange })));
};
var SelSingleLoad = function (_a) {
    var _b;
    var loadOptions = _a.loadOptions, allowCustomValue = _a.allowCustomValue, onChange = _a.onChange, onClose = _a.onClose;
    var _c = __read(useAsyncFn(loadOptions, [loadOptions]), 2), loadState = _c[0], doLoad = _c[1];
    useEffect(function () {
        doLoad('');
    }, [doLoad, loadOptions]);
    return (React.createElement("div", { className: selectClass },
        React.createElement(Select, { menuShouldPortal: true, isLoading: loadState.loading, formatCreateLabel: formatCreateLabel, autoFocus: true, isOpen: true, onCloseMenu: onClose, allowCustomValue: allowCustomValue, options: (_b = loadState.value) !== null && _b !== void 0 ? _b : [], onChange: onChange })));
};
var Sel = function (_a) {
    var loadOptions = _a.loadOptions, filterByLoadOptions = _a.filterByLoadOptions, allowCustomValue = _a.allowCustomValue, onChange = _a.onChange, onClose = _a.onClose;
    // unfortunately <Segment/> and <SegmentAsync/> have somewhat different behavior,
    // so the simplest approach was to just create two separate wrapper-components
    return filterByLoadOptions ? (React.createElement(SelReload, { loadOptions: loadOptions, allowCustomValue: allowCustomValue, onChange: onChange, onClose: onClose })) : (React.createElement(SelSingleLoad, { loadOptions: loadOptions, allowCustomValue: allowCustomValue, onChange: onChange, onClose: onClose }));
};
var Inp = function (_a) {
    var initialValue = _a.initialValue, onChange = _a.onChange, onClose = _a.onClose;
    var _b = __read(useShadowedState(initialValue), 2), currentValue = _b[0], setCurrentValue = _b[1];
    return (React.createElement(Input, { autoFocus: true, type: "text", spellCheck: false, onBlur: onClose, onKeyDown: function (e) {
            if (e.key === 'Enter') {
                onChange(currentValue);
            }
        }, onChange: function (e) {
            setCurrentValue(e.currentTarget.value);
        }, value: currentValue }));
};
var defaultButtonClass = css({
    width: 'auto',
    cursor: 'pointer',
});
export var Seg = function (_a) {
    var value = _a.value, buttonClassName = _a.buttonClassName, loadOptions = _a.loadOptions, filterByLoadOptions = _a.filterByLoadOptions, allowCustomValue = _a.allowCustomValue, onChange = _a.onChange;
    var _b = __read(useState(false), 2), isOpen = _b[0], setOpen = _b[1];
    if (!isOpen) {
        var className = cx(defaultButtonClass, buttonClassName);
        return (React.createElement(InlineLabel, { as: "button", className: className, onClick: function () {
                setOpen(true);
            } }, value));
    }
    else {
        if (loadOptions !== undefined) {
            return (React.createElement(Sel, { loadOptions: loadOptions, filterByLoadOptions: filterByLoadOptions !== null && filterByLoadOptions !== void 0 ? filterByLoadOptions : false, allowCustomValue: allowCustomValue, onChange: function (v) {
                    setOpen(false);
                    onChange(v);
                }, onClose: function () {
                    setOpen(false);
                } }));
        }
        else {
            return (React.createElement(Inp, { initialValue: value, onClose: function () {
                    setOpen(false);
                }, onChange: function (v) {
                    setOpen(false);
                    onChange({ value: v, label: v });
                } }));
        }
    }
};
//# sourceMappingURL=Seg.js.map