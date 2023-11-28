import { css, cx } from '@emotion/css';
import debouncePromise from 'debounce-promise';
import React, { useEffect, useState } from 'react';
import { useAsyncFn } from 'react-use';
import { AsyncSelect, InlineLabel, Input, Select } from '@grafana/ui';
import { useShadowedState } from '../hooks/useShadowedState';
const selectClass = css({
    minWidth: '160px',
});
// when a custom value is written into a select-box,
// by default the new value is prefixed with "Create:",
// and that sounds confusing because here we do not create
// anything. we change this to just be the entered string.
const formatCreateLabel = (v) => v;
const SelReload = ({ loadOptions, allowCustomValue, onChange, onClose }) => {
    // here we rely on the fact that writing text into the <AsyncSelect/>
    // does not cause a re-render of the current react component.
    // this way there is only a single render-call,
    // so there is only a single `debouncedLoadOptions`.
    // if we want ot make this "re-render safe,
    // we will have to put the debounced call into an useRef,
    // and probably have an useEffect
    const debouncedLoadOptions = debouncePromise(loadOptions, 1000, { leading: true });
    return (React.createElement("div", { className: selectClass },
        React.createElement(AsyncSelect, { formatCreateLabel: formatCreateLabel, defaultOptions: true, autoFocus: true, isOpen: true, onCloseMenu: onClose, allowCustomValue: allowCustomValue, loadOptions: debouncedLoadOptions, onChange: onChange, createOptionPosition: "first" })));
};
const SelSingleLoad = ({ loadOptions, allowCustomValue, onChange, onClose }) => {
    var _a;
    const [loadState, doLoad] = useAsyncFn(loadOptions, [loadOptions]);
    useEffect(() => {
        doLoad('');
    }, [doLoad, loadOptions]);
    return (React.createElement("div", { className: selectClass },
        React.createElement(Select, { isLoading: loadState.loading, formatCreateLabel: formatCreateLabel, autoFocus: true, isOpen: !loadState.loading, onCloseMenu: onClose, allowCustomValue: allowCustomValue, options: (_a = loadState.value) !== null && _a !== void 0 ? _a : [], onChange: onChange, createOptionPosition: "first" })));
};
const Sel = ({ loadOptions, filterByLoadOptions, allowCustomValue, onChange, onClose }) => {
    // unfortunately <Segment/> and <SegmentAsync/> have somewhat different behavior,
    // so the simplest approach was to just create two separate wrapper-components
    return filterByLoadOptions ? (React.createElement(SelReload, { loadOptions: loadOptions, allowCustomValue: allowCustomValue, onChange: onChange, onClose: onClose })) : (React.createElement(SelSingleLoad, { loadOptions: loadOptions, allowCustomValue: allowCustomValue, onChange: onChange, onClose: onClose }));
};
const Inp = ({ initialValue, onChange, onClose }) => {
    const [currentValue, setCurrentValue] = useShadowedState(initialValue);
    return (React.createElement(Input, { autoFocus: true, type: "text", spellCheck: false, onBlur: onClose, onKeyDown: (e) => {
            if (e.key === 'Enter') {
                onChange(currentValue);
            }
        }, onChange: (e) => {
            setCurrentValue(e.currentTarget.value);
        }, value: currentValue }));
};
const defaultButtonClass = css({
    width: 'auto',
    cursor: 'pointer',
});
export const Seg = ({ value, buttonClassName, loadOptions, filterByLoadOptions, allowCustomValue, onChange, }) => {
    const [isOpen, setOpen] = useState(false);
    if (!isOpen) {
        const className = cx(defaultButtonClass, buttonClassName);
        return (React.createElement(InlineLabel, { as: "button", className: className, onClick: () => {
                setOpen(true);
            } }, value));
    }
    else {
        if (loadOptions !== undefined) {
            return (React.createElement(Sel, { loadOptions: loadOptions, filterByLoadOptions: filterByLoadOptions !== null && filterByLoadOptions !== void 0 ? filterByLoadOptions : false, allowCustomValue: allowCustomValue, onChange: (v) => {
                    setOpen(false);
                    onChange(v);
                }, onClose: () => {
                    setOpen(false);
                } }));
        }
        else {
            return (React.createElement(Inp, { initialValue: value, onClose: () => {
                    setOpen(false);
                }, onChange: (v) => {
                    setOpen(false);
                    onChange({ value: v, label: v });
                } }));
        }
    }
};
//# sourceMappingURL=Seg.js.map