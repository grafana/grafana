import { __assign, __extends, __read, __spreadArray } from "tslib";
import React, { PureComponent } from 'react';
import { Button, InlineField, InlineFieldRow, Input } from '@grafana/ui';
import { defaultCSVWaveQuery } from '../constants';
var CSVWaveEditor = /** @class */ (function (_super) {
    __extends(CSVWaveEditor, _super);
    function CSVWaveEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onFieldChange = function (field) { return function (e) {
            var _a;
            var value = e.target.value;
            _this.props.onChange(_this.props.index, __assign(__assign({}, _this.props.wave), (_a = {}, _a[field] = value, _a)));
        }; };
        _this.onNameChange = _this.onFieldChange('name');
        _this.onLabelsChange = _this.onFieldChange('labels');
        _this.onCSVChange = _this.onFieldChange('valuesCSV');
        _this.onTimeStepChange = function (e) {
            var timeStep = e.target.valueAsNumber;
            _this.props.onChange(_this.props.index, __assign(__assign({}, _this.props.wave), { timeStep: timeStep }));
        };
        return _this;
    }
    CSVWaveEditor.prototype.render = function () {
        var _this = this;
        var _a = this.props, wave = _a.wave, last = _a.last;
        var action = this.props.onAdd;
        if (!last) {
            action = function () {
                _this.props.onChange(_this.props.index, undefined); // remove
            };
        }
        return (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: 'Values', grow: true, tooltip: "Comma separated values. Each value may be an int, float, or null and must not be empty. Whitespace and trailing commas are removed" },
                React.createElement(Input, { value: wave.valuesCSV, placeholder: 'CSV values', onChange: this.onCSVChange, autoFocus: true })),
            React.createElement(InlineField, { label: 'Step', tooltip: "The number of seconds between datapoints." },
                React.createElement(Input, { value: wave.timeStep, type: "number", placeholder: '60', width: 6, onChange: this.onTimeStepChange })),
            React.createElement(InlineField, { label: 'Labels' },
                React.createElement(Input, { value: wave.labels, placeholder: 'labels', width: 12, onChange: this.onLabelsChange })),
            React.createElement(InlineField, { label: 'Name' },
                React.createElement(Input, { value: wave.name, placeholder: 'name', width: 10, onChange: this.onNameChange })),
            React.createElement(Button, { icon: last ? 'plus' : 'minus', variant: "secondary", onClick: action })));
    };
    return CSVWaveEditor;
}(PureComponent));
var CSVWavesEditor = /** @class */ (function (_super) {
    __extends(CSVWavesEditor, _super);
    function CSVWavesEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onChange = function (index, wave) {
            var _a;
            var waves = __spreadArray([], __read(((_a = _this.props.waves) !== null && _a !== void 0 ? _a : defaultCSVWaveQuery)), false);
            if (wave) {
                waves[index] = __assign({}, wave);
            }
            else {
                // remove the element
                waves.splice(index, 1);
            }
            _this.props.onChange(waves);
        };
        _this.onAdd = function () {
            var _a;
            var waves = __spreadArray([], __read(((_a = _this.props.waves) !== null && _a !== void 0 ? _a : defaultCSVWaveQuery)), false);
            waves.push(__assign({}, defaultCSVWaveQuery[0]));
            _this.props.onChange(waves);
        };
        return _this;
    }
    CSVWavesEditor.prototype.render = function () {
        var _this = this;
        var _a;
        var waves = (_a = this.props.waves) !== null && _a !== void 0 ? _a : defaultCSVWaveQuery;
        if (!waves.length) {
            waves = defaultCSVWaveQuery;
        }
        return (React.createElement(React.Fragment, null, waves.map(function (wave, index) { return (React.createElement(CSVWaveEditor, { key: index + "/" + wave.valuesCSV, wave: wave, index: index, onAdd: _this.onAdd, onChange: _this.onChange, last: index === waves.length - 1 })); })));
    };
    return CSVWavesEditor;
}(PureComponent));
export { CSVWavesEditor };
//# sourceMappingURL=CSVWaveEditor.js.map