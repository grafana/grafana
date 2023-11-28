import React, { PureComponent, useState } from 'react';
import { Button, InlineField, InlineFieldRow, Input } from '@grafana/ui';
import { defaultCSVWaveQuery } from '../constants';
const CSVWaveEditor = (props) => {
    const { wave, last, index, onAdd, onChange } = props;
    const [valuesCSV, setValuesCSV] = useState(wave.valuesCSV || '');
    const [labels, setLabels] = useState(wave.labels || '');
    const [name, setName] = useState(wave.name || '');
    const onAction = () => {
        if (last) {
            onAdd();
        }
        else {
            onChange(index, undefined);
        }
    };
    const onValueChange = (key, value) => {
        onChange(index, Object.assign(Object.assign({}, wave), { [key]: value }));
    };
    const onKeyDown = (evt) => {
        if (evt.key === 'Enter') {
            onValueChange('valuesCSV', valuesCSV);
        }
    };
    return (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { label: 'Values', grow: true, tooltip: "Comma separated values. Each value may be an int, float, or null and must not be empty. Whitespace and trailing commas are removed" },
            React.createElement(Input, { value: valuesCSV, placeholder: 'CSV values', onChange: (e) => setValuesCSV(e.currentTarget.value), autoFocus: true, onBlur: () => onValueChange('valuesCSV', valuesCSV), onKeyDown: onKeyDown })),
        React.createElement(InlineField, { label: 'Step', tooltip: "The number of seconds between datapoints." },
            React.createElement(Input, { value: wave.timeStep, type: "number", placeholder: '60', width: 10, onChange: (e) => onValueChange('timeStep', e.currentTarget.valueAsNumber) })),
        React.createElement(InlineField, { label: 'Name' },
            React.createElement(Input, { value: name, placeholder: 'name', width: 10, onChange: (e) => setName(e.currentTarget.value), onBlur: () => onValueChange('name', name) })),
        React.createElement(InlineField, { label: 'Labels' },
            React.createElement(Input, { value: labels, placeholder: 'labels', width: 12, onChange: (e) => setLabels(e.currentTarget.value), onBlur: () => onValueChange('labels', labels) })),
        React.createElement(Button, { icon: last ? 'plus' : 'minus', variant: "secondary", onClick: onAction })));
};
export class CSVWavesEditor extends PureComponent {
    constructor() {
        super(...arguments);
        this.onChange = (index, wave) => {
            var _a;
            let waves = [...((_a = this.props.waves) !== null && _a !== void 0 ? _a : defaultCSVWaveQuery)];
            if (wave) {
                waves[index] = Object.assign({}, wave);
            }
            else {
                // remove the element
                waves.splice(index, 1);
            }
            this.props.onChange(waves);
        };
        this.onAdd = () => {
            var _a;
            const waves = [...((_a = this.props.waves) !== null && _a !== void 0 ? _a : defaultCSVWaveQuery)];
            waves.push(Object.assign({}, defaultCSVWaveQuery[0]));
            this.props.onChange(waves);
        };
    }
    render() {
        var _a;
        let waves = (_a = this.props.waves) !== null && _a !== void 0 ? _a : defaultCSVWaveQuery;
        if (!waves.length) {
            waves = defaultCSVWaveQuery;
        }
        return (React.createElement(React.Fragment, null, waves.map((wave, index) => (React.createElement(CSVWaveEditor, { key: `${index}/${wave.valuesCSV}`, wave: wave, index: index, onAdd: this.onAdd, onChange: this.onChange, last: index === waves.length - 1 })))));
    }
}
//# sourceMappingURL=CSVWaveEditor.js.map