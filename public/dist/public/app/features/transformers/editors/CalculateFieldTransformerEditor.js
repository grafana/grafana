import { defaults } from 'lodash';
import React from 'react';
import { identity, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { BinaryOperationID, binaryOperators, unaryOperators, DataTransformerID, FieldType, getFieldDisplayName, ReducerID, standardTransformers, TransformerCategory, UnaryOperationID, } from '@grafana/data';
import { CalculateFieldMode, getNameFromOptions, } from '@grafana/data/src/transformations/transformers/calculateField';
import { getTemplateSrv, config as cfg } from '@grafana/runtime';
import { FilterPill, HorizontalGroup, InlineField, InlineFieldRow, InlineLabel, InlineSwitch, Input, Select, StatsPicker, } from '@grafana/ui';
const calculationModes = [
    { value: CalculateFieldMode.BinaryOperation, label: 'Binary operation' },
    { value: CalculateFieldMode.UnaryOperation, label: 'Unary operation' },
    { value: CalculateFieldMode.ReduceRow, label: 'Reduce row' },
    { value: CalculateFieldMode.Index, label: 'Row index' },
];
const okTypes = new Set([FieldType.time, FieldType.number, FieldType.string]);
const labelWidth = 16;
export class CalculateFieldTransformerEditor extends React.PureComponent {
    constructor(props) {
        var _a, _b;
        super(props);
        this.onToggleReplaceFields = (e) => {
            const { options } = this.props;
            this.props.onChange(Object.assign(Object.assign({}, options), { replaceFields: e.currentTarget.checked }));
        };
        this.onToggleRowIndexAsPercentile = (e) => {
            const { options } = this.props;
            this.props.onChange(Object.assign(Object.assign({}, options), { index: {
                    asPercentile: e.currentTarget.checked,
                } }));
        };
        this.onModeChanged = (value) => {
            var _a;
            const { options, onChange } = this.props;
            const mode = (_a = value.value) !== null && _a !== void 0 ? _a : CalculateFieldMode.BinaryOperation;
            onChange(Object.assign(Object.assign({}, options), { mode }));
        };
        this.onAliasChanged = (evt) => {
            const { options } = this.props;
            this.props.onChange(Object.assign(Object.assign({}, options), { alias: evt.target.value }));
        };
        //---------------------------------------------------------
        // Reduce by Row
        //---------------------------------------------------------
        this.updateReduceOptions = (v) => {
            const { options, onChange } = this.props;
            onChange(Object.assign(Object.assign({}, options), { mode: CalculateFieldMode.ReduceRow, reduce: v }));
        };
        this.onFieldToggle = (fieldName) => {
            const { selected } = this.state;
            if (selected.indexOf(fieldName) > -1) {
                this.onChange(selected.filter((s) => s !== fieldName));
            }
            else {
                this.onChange([...selected, fieldName]);
            }
        };
        this.onChange = (selected) => {
            this.setState({ selected });
            const { reduce } = this.props.options;
            this.updateReduceOptions(Object.assign(Object.assign({}, reduce), { include: selected }));
        };
        this.onStatsChange = (stats) => {
            const reducer = stats.length ? stats[0] : ReducerID.sum;
            const { reduce } = this.props.options;
            this.updateReduceOptions(Object.assign(Object.assign({}, reduce), { reducer }));
        };
        //---------------------------------------------------------
        // Binary Operator
        //---------------------------------------------------------
        this.updateBinaryOptions = (v) => {
            const { options, onChange } = this.props;
            onChange(Object.assign(Object.assign({}, options), { mode: CalculateFieldMode.BinaryOperation, binary: v }));
        };
        this.onBinaryLeftChanged = (v) => {
            const { binary } = this.props.options;
            this.updateBinaryOptions(Object.assign(Object.assign({}, binary), { left: v.value }));
        };
        this.onBinaryRightChanged = (v) => {
            const { binary } = this.props.options;
            this.updateBinaryOptions(Object.assign(Object.assign({}, binary), { right: v.value }));
        };
        this.onBinaryOperationChanged = (v) => {
            const { binary } = this.props.options;
            this.updateBinaryOptions(Object.assign(Object.assign({}, binary), { operator: v.value }));
        };
        //---------------------------------------------------------
        // Unary Operator
        //---------------------------------------------------------
        this.updateUnaryOptions = (v) => {
            const { options, onChange } = this.props;
            onChange(Object.assign(Object.assign({}, options), { mode: CalculateFieldMode.UnaryOperation, unary: v }));
        };
        this.onUnaryOperationChanged = (v) => {
            const { unary } = this.props.options;
            this.updateUnaryOptions(Object.assign(Object.assign({}, unary), { operator: v.value }));
        };
        this.onUnaryValueChanged = (v) => {
            const { unary } = this.props.options;
            this.updateUnaryOptions(Object.assign(Object.assign({}, unary), { fieldName: v.value }));
        };
        this.state = {
            include: ((_b = (_a = props.options) === null || _a === void 0 ? void 0 : _a.reduce) === null || _b === void 0 ? void 0 : _b.include) || [],
            names: [],
            selected: [],
        };
    }
    componentDidMount() {
        this.initOptions();
    }
    componentDidUpdate(oldProps) {
        if (this.props.input !== oldProps.input) {
            this.initOptions();
        }
    }
    initOptions() {
        var _a;
        const { options } = this.props;
        const configuredOptions = ((_a = options === null || options === void 0 ? void 0 : options.reduce) === null || _a === void 0 ? void 0 : _a.include) || [];
        const ctx = { interpolate: (v) => v };
        const subscription = of(this.props.input)
            .pipe(standardTransformers.ensureColumnsTransformer.operator(null, ctx), this.extractAllNames(), this.getVariableNames(), this.extractNamesAndSelected(configuredOptions))
            .subscribe(({ selected, names }) => {
            this.setState({ names, selected }, () => subscription.unsubscribe());
        });
    }
    getVariableNames() {
        if (!cfg.featureToggles.transformationsVariableSupport) {
            return identity;
        }
        const templateSrv = getTemplateSrv();
        return (source) => source.pipe(map((input) => {
            input.push(...templateSrv.getVariables().map((v) => '$' + v.name));
            return input;
        }));
    }
    extractAllNames() {
        return (source) => source.pipe(map((input) => {
            const allNames = [];
            const byName = {};
            for (const frame of input) {
                for (const field of frame.fields) {
                    if (!okTypes.has(field.type)) {
                        continue;
                    }
                    const displayName = getFieldDisplayName(field, frame, input);
                    if (!byName[displayName]) {
                        byName[displayName] = true;
                        allNames.push(displayName);
                    }
                }
            }
            return allNames;
        }));
    }
    extractNamesAndSelected(configuredOptions) {
        return (source) => source.pipe(map((allNames) => {
            if (!configuredOptions.length) {
                return { names: allNames, selected: [] };
            }
            const names = [];
            const selected = [];
            for (const v of allNames) {
                if (configuredOptions.includes(v)) {
                    selected.push(v);
                }
                names.push(v);
            }
            return { names, selected };
        }));
    }
    renderRowIndex(options) {
        return (React.createElement(React.Fragment, null,
            React.createElement(InlineField, { labelWidth: labelWidth, label: "As percentile", tooltip: "Transform the row index as a percentile." },
                React.createElement(InlineSwitch, { value: !!(options === null || options === void 0 ? void 0 : options.asPercentile), onChange: this.onToggleRowIndexAsPercentile }))));
    }
    renderReduceRow(options) {
        const { names, selected } = this.state;
        options = defaults(options, { reducer: ReducerID.sum });
        return (React.createElement(React.Fragment, null,
            React.createElement(InlineField, { label: "Operation", labelWidth: labelWidth, grow: true },
                React.createElement(HorizontalGroup, { spacing: "xs", align: "flex-start", wrap: true }, names.map((o, i) => {
                    return (React.createElement(FilterPill, { key: `${o}/${i}`, onClick: () => {
                            this.onFieldToggle(o);
                        }, label: o, selected: selected.indexOf(o) > -1 }));
                }))),
            React.createElement(InlineField, { label: "Calculation", labelWidth: labelWidth },
                React.createElement(StatsPicker, { allowMultiple: false, className: "width-18", stats: [options.reducer], onChange: this.onStatsChange, defaultStat: ReducerID.sum }))));
    }
    renderBinaryOperation(options) {
        var _a;
        options = defaults(options, { operator: BinaryOperationID.Add });
        let foundLeft = !(options === null || options === void 0 ? void 0 : options.left);
        let foundRight = !(options === null || options === void 0 ? void 0 : options.right);
        const names = this.state.names.map((v) => {
            if (v === (options === null || options === void 0 ? void 0 : options.left)) {
                foundLeft = true;
            }
            if (v === (options === null || options === void 0 ? void 0 : options.right)) {
                foundRight = true;
            }
            return { label: v, value: v };
        });
        const leftNames = foundLeft ? names : [...names, { label: options === null || options === void 0 ? void 0 : options.left, value: options === null || options === void 0 ? void 0 : options.left }];
        const rightNames = foundRight ? names : [...names, { label: options === null || options === void 0 ? void 0 : options.right, value: options === null || options === void 0 ? void 0 : options.right }];
        const ops = binaryOperators.list().map((v) => {
            return { label: v.binaryOperationID, value: v.binaryOperationID };
        });
        return (React.createElement(React.Fragment, null,
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Operation", labelWidth: labelWidth },
                    React.createElement(Select, { allowCustomValue: true, placeholder: "Field or number", options: leftNames, className: "min-width-18", value: options === null || options === void 0 ? void 0 : options.left, onChange: this.onBinaryLeftChanged })),
                React.createElement(InlineField, null,
                    React.createElement(Select, { className: "width-4", options: ops, value: (_a = options.operator) !== null && _a !== void 0 ? _a : ops[0].value, onChange: this.onBinaryOperationChanged })),
                React.createElement(InlineField, null,
                    React.createElement(Select, { allowCustomValue: true, placeholder: "Field or number", className: "min-width-10", options: rightNames, value: options === null || options === void 0 ? void 0 : options.right, onChange: this.onBinaryRightChanged })))));
    }
    renderUnaryOperation(options) {
        var _a;
        options = defaults(options, { operator: UnaryOperationID.Abs });
        let found = !(options === null || options === void 0 ? void 0 : options.fieldName);
        const names = this.state.names.map((v) => {
            if (v === (options === null || options === void 0 ? void 0 : options.fieldName)) {
                found = true;
            }
            return { label: v, value: v };
        });
        const ops = unaryOperators.list().map((v) => {
            return { label: v.unaryOperationID, value: v.unaryOperationID };
        });
        const fieldName = found ? names : [...names, { label: options === null || options === void 0 ? void 0 : options.fieldName, value: options === null || options === void 0 ? void 0 : options.fieldName }];
        return (React.createElement(React.Fragment, null,
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Operation", labelWidth: labelWidth },
                    React.createElement(Select, { options: ops, value: (_a = options.operator) !== null && _a !== void 0 ? _a : ops[0].value, onChange: this.onUnaryOperationChanged })),
                React.createElement(InlineField, { label: "(", labelWidth: 2 },
                    React.createElement(Select, { placeholder: "Field", className: "min-width-11", options: fieldName, value: options === null || options === void 0 ? void 0 : options.fieldName, onChange: this.onUnaryValueChanged })),
                React.createElement(InlineLabel, { width: 2 }, ")"))));
    }
    //---------------------------------------------------------
    // Render
    //---------------------------------------------------------
    render() {
        var _a, _b;
        const { options } = this.props;
        const mode = (_a = options.mode) !== null && _a !== void 0 ? _a : CalculateFieldMode.BinaryOperation;
        return (React.createElement(React.Fragment, null,
            React.createElement(InlineField, { labelWidth: labelWidth, label: "Mode" },
                React.createElement(Select, { className: "width-18", options: calculationModes, value: calculationModes.find((v) => v.value === mode), onChange: this.onModeChanged })),
            mode === CalculateFieldMode.BinaryOperation && this.renderBinaryOperation(options.binary),
            mode === CalculateFieldMode.UnaryOperation && this.renderUnaryOperation(options.unary),
            mode === CalculateFieldMode.ReduceRow && this.renderReduceRow(options.reduce),
            mode === CalculateFieldMode.Index && this.renderRowIndex(options.index),
            React.createElement(InlineField, { labelWidth: labelWidth, label: "Alias" },
                React.createElement(Input, { className: "width-18", value: (_b = options.alias) !== null && _b !== void 0 ? _b : '', placeholder: getNameFromOptions(options), onChange: this.onAliasChanged })),
            React.createElement(InlineField, { labelWidth: labelWidth, label: "Replace all fields" },
                React.createElement(InlineSwitch, { value: !!options.replaceFields, onChange: this.onToggleReplaceFields }))));
    }
}
export const calculateFieldTransformRegistryItem = {
    id: DataTransformerID.calculateField,
    editor: CalculateFieldTransformerEditor,
    transformation: standardTransformers.calculateFieldTransformer,
    name: 'Add field from calculation',
    description: 'Use the row values to calculate a new field.',
    categories: new Set([TransformerCategory.CalculateNewFields]),
};
//# sourceMappingURL=CalculateFieldTransformerEditor.js.map