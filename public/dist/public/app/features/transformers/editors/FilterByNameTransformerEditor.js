import React from 'react';
import { DataTransformerID, standardTransformers, getFieldDisplayName, stringToJsRegex, TransformerCategory, } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime/src/services';
import { Input, FilterPill, InlineFieldRow, InlineField, InlineSwitch, Select } from '@grafana/ui';
export class FilterByNameTransformerEditor extends React.PureComponent {
    constructor(props) {
        var _a, _b, _c;
        super(props);
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
            var _a;
            const { regex, isRegexValid } = this.state;
            const options = Object.assign(Object.assign({}, this.props.options), { include: { names: selected } });
            if (regex && isRegexValid) {
                options.include = (_a = options.include) !== null && _a !== void 0 ? _a : {};
                options.include.pattern = regex;
            }
            this.setState({ selected }, () => {
                this.props.onChange(options);
            });
        };
        this.onInputBlur = (e) => {
            const { selected, regex } = this.state;
            let isRegexValid = true;
            try {
                if (regex) {
                    stringToJsRegex(regex);
                }
            }
            catch (e) {
                isRegexValid = false;
            }
            if (isRegexValid) {
                this.props.onChange(Object.assign(Object.assign({}, this.props.options), { include: { pattern: regex } }));
            }
            else {
                this.props.onChange(Object.assign(Object.assign({}, this.props.options), { include: { names: selected } }));
            }
            this.setState({ isRegexValid });
        };
        this.onVariableChange = (selected) => {
            this.props.onChange(Object.assign(Object.assign({}, this.props.options), { include: { variable: selected.value } }));
            this.setState({ variable: selected.value });
        };
        this.onFromVariableChange = (e) => {
            const val = e.currentTarget.checked;
            this.props.onChange(Object.assign(Object.assign({}, this.props.options), { byVariable: val }));
            this.setState({ byVariable: val });
        };
        this.state = {
            include: ((_a = props.options.include) === null || _a === void 0 ? void 0 : _a.names) || [],
            regex: (_b = props.options.include) === null || _b === void 0 ? void 0 : _b.pattern,
            variable: (_c = props.options.include) === null || _c === void 0 ? void 0 : _c.variable,
            byVariable: props.options.byVariable || false,
            options: [],
            variables: [],
            selected: [],
            isRegexValid: true,
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
        var _a, _b, _c, _d, _e, _f, _g;
        const { input, options } = this.props;
        const configuredOptions = Array.from((_b = (_a = options.include) === null || _a === void 0 ? void 0 : _a.names) !== null && _b !== void 0 ? _b : []);
        const variables = getTemplateSrv()
            .getVariables()
            .map((v) => ({ label: '$' + v.name, value: '$' + v.name }));
        const allNames = [];
        const byName = {};
        for (const frame of input) {
            for (const field of frame.fields) {
                const displayName = getFieldDisplayName(field, frame, input);
                let v = byName[displayName];
                if (!v) {
                    v = byName[displayName] = {
                        name: displayName,
                        count: 0,
                    };
                    allNames.push(v);
                }
                v.count++;
            }
        }
        if ((_c = options.include) === null || _c === void 0 ? void 0 : _c.pattern) {
            try {
                const regex = stringToJsRegex(options.include.pattern);
                for (const info of allNames) {
                    if (regex.test(info.name)) {
                        configuredOptions.push(info.name);
                    }
                }
            }
            catch (error) {
                console.error(error);
            }
        }
        if (configuredOptions.length) {
            const selected = allNames.filter((n) => configuredOptions.includes(n.name));
            this.setState({
                options: allNames,
                selected: selected.map((s) => s.name),
                variables: variables,
                byVariable: options.byVariable || false,
                variable: (_d = options.include) === null || _d === void 0 ? void 0 : _d.variable,
                regex: (_e = options.include) === null || _e === void 0 ? void 0 : _e.pattern,
            });
        }
        else {
            this.setState({
                options: allNames,
                selected: allNames.map((n) => n.name),
                variables: variables,
                byVariable: options.byVariable || false,
                variable: (_f = options.include) === null || _f === void 0 ? void 0 : _f.variable,
                regex: (_g = options.include) === null || _g === void 0 ? void 0 : _g.pattern,
            });
        }
    }
    render() {
        const { options, selected, isRegexValid } = this.state;
        return (React.createElement("div", null,
            React.createElement(InlineFieldRow, { label: "Use variable" },
                React.createElement(InlineField, { label: "From variable" },
                    React.createElement(InlineSwitch, { value: this.state.byVariable, onChange: this.onFromVariableChange }))),
            this.state.byVariable ? (React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Variable" },
                    React.createElement(Select, { value: this.state.variable, onChange: this.onVariableChange, options: this.state.variables || [] })))) : (React.createElement(InlineFieldRow, { label: "Identifier" },
                React.createElement(InlineField, { label: "Identifier", invalid: !isRegexValid, error: !isRegexValid ? 'Invalid pattern' : undefined },
                    React.createElement(Input, { placeholder: "Regular expression pattern", value: this.state.regex || '', onChange: (e) => this.setState({ regex: e.currentTarget.value }), onBlur: this.onInputBlur, width: 25 })),
                options.map((o, i) => {
                    const label = `${o.name}${o.count > 1 ? ' (' + o.count + ')' : ''}`;
                    const isSelected = selected.indexOf(o.name) > -1;
                    return (React.createElement(FilterPill, { key: `${o.name}/${i}`, onClick: () => {
                            this.onFieldToggle(o.name);
                        }, label: label, selected: isSelected }));
                })))));
    }
}
export const filterFieldsByNameTransformRegistryItem = {
    id: DataTransformerID.filterFieldsByName,
    editor: FilterByNameTransformerEditor,
    transformation: standardTransformers.filterFieldsByNameTransformer,
    name: 'Filter by name',
    description: 'Removes part of the query results using a regex pattern. The pattern can be inclusive or exclusive.',
    categories: new Set([TransformerCategory.Filter]),
};
//# sourceMappingURL=FilterByNameTransformerEditor.js.map