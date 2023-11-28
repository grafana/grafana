import { debounce } from 'lodash';
import React, { PureComponent } from 'react';
import { Field, Input } from '@grafana/ui';
/**
 * This is an Input field that will call `onChange` for blur and enter
 *
 * @internal this is not exported to the `@grafana/ui` library, it is used
 * by options editor (number and slider), and direclty with in grafana core
 */
export class NumberInput extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = { text: '', inputCorrected: false };
        this.inputRef = React.createRef();
        this.updateValue = () => {
            var _a;
            const txt = (_a = this.inputRef.current) === null || _a === void 0 ? void 0 : _a.value;
            let corrected = false;
            let newValue = '';
            const min = this.props.min;
            const max = this.props.max;
            let currentValue = txt !== '' ? Number(txt) : undefined;
            if (currentValue && !Number.isNaN(currentValue)) {
                if (min != null && currentValue < min) {
                    newValue = min.toString();
                    corrected = true;
                }
                else if (max != null && currentValue > max) {
                    newValue = max.toString();
                    corrected = true;
                }
                else {
                    newValue = txt !== null && txt !== void 0 ? txt : '';
                }
                this.setState({
                    text: newValue,
                    inputCorrected: corrected,
                });
            }
            if (corrected) {
                this.updateValueDebounced();
            }
            if (!Number.isNaN(currentValue) && currentValue !== this.props.value) {
                this.props.onChange(currentValue);
            }
        };
        this.updateValueDebounced = debounce(this.updateValue, 500); // 1/2 second delay
        this.onChange = (e) => {
            this.setState({
                text: e.currentTarget.value,
            });
            this.updateValueDebounced();
        };
        this.onKeyPress = (e) => {
            if (e.key === 'Enter') {
                this.updateValue();
            }
        };
    }
    componentDidMount() {
        this.setState({
            text: isNaN(this.props.value) ? '' : `${this.props.value}`,
        });
    }
    componentDidUpdate(oldProps) {
        if (this.props.value !== oldProps.value) {
            const text = isNaN(this.props.value) ? '' : `${this.props.value}`;
            if (text !== this.state.text) {
                this.setState({ text });
            }
        }
    }
    renderInput() {
        return (React.createElement(Input, { type: "number", ref: this.inputRef, min: this.props.min, max: this.props.max, step: this.props.step, autoFocus: this.props.autoFocus, value: this.state.text, onChange: this.onChange, onBlur: this.updateValue, onKeyPress: this.onKeyPress, placeholder: this.props.placeholder, disabled: this.props.fieldDisabled, width: this.props.width, suffix: this.props.suffix }));
    }
    render() {
        const { inputCorrected } = this.state;
        if (inputCorrected) {
            let range = '';
            let { min, max } = this.props;
            if (max == null) {
                if (min != null) {
                    range = `< ${min}`;
                }
            }
            else if (min != null) {
                range = `${min} < > ${max}`;
            }
            else {
                range = `> ${max}`;
            }
            return (React.createElement(Field, { invalid: inputCorrected, error: `Out of range ${range}`, validationMessageHorizontalOverflow: true, style: { direction: 'rtl' } }, this.renderInput()));
        }
        return this.renderInput();
    }
}
//# sourceMappingURL=NumberInput.js.map