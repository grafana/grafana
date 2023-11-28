import { __rest } from "tslib";
import React, { PureComponent } from 'react';
import { t } from 'app/core/internationalization';
import { NavigationKey } from '../types';
export class VariableInput extends PureComponent {
    constructor() {
        super(...arguments);
        this.onKeyDown = (event) => {
            if (NavigationKey[event.keyCode] && event.keyCode !== NavigationKey.select) {
                const clearOthers = event.ctrlKey || event.metaKey || event.shiftKey;
                this.props.onNavigate(event.keyCode, clearOthers);
                event.preventDefault();
            }
        };
        this.onChange = (event) => {
            this.props.onChange(event.target.value);
        };
    }
    render() {
        const _a = this.props, { value, id, onNavigate } = _a, restProps = __rest(_a, ["value", "id", "onNavigate"]);
        return (React.createElement("input", Object.assign({}, restProps, { ref: (instance) => {
                if (instance) {
                    instance.focus();
                    instance.setAttribute('style', `width:${Math.max(instance.width, 150)}px`);
                }
            }, type: "text", className: "gf-form-input", value: value !== null && value !== void 0 ? value : '', onChange: this.onChange, onKeyDown: this.onKeyDown, placeholder: t('variable.dropdown.placeholder', 'Enter variable value') })));
    }
}
//# sourceMappingURL=VariableInput.js.map