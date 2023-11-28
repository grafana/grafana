import React, { PureComponent } from 'react';
import { getFieldDisplayName, formattedValueToString, AnnotationEventFieldSource, getValueFormat, } from '@grafana/data';
import { Select, Tooltip, Icon } from '@grafana/ui';
import { annotationEventNames } from '../standardAnnotationSupport';
export class AnnotationFieldMapper extends PureComponent {
    constructor(props) {
        super(props);
        this.updateFields = () => {
            var _a, _b, _c, _d;
            const panelData = (_a = this.props.response) === null || _a === void 0 ? void 0 : _a.panelData;
            const frame = (_c = (_b = panelData === null || panelData === void 0 ? void 0 : panelData.series) === null || _b === void 0 ? void 0 : _b[0]) !== null && _c !== void 0 ? _c : (_d = panelData === null || panelData === void 0 ? void 0 : panelData.annotations) === null || _d === void 0 ? void 0 : _d[0];
            if (frame && frame.fields) {
                const fieldNames = frame.fields.map((f) => {
                    const name = getFieldDisplayName(f, frame);
                    let description = '';
                    for (let i = 0; i < frame.length; i++) {
                        if (i > 0) {
                            description += ', ';
                        }
                        if (i > 2) {
                            description += '...';
                            break;
                        }
                        description += f.values[i];
                    }
                    if (description.length > 50) {
                        description = description.substring(0, 50) + '...';
                    }
                    return {
                        label: `${name} (${f.type})`,
                        value: name,
                        description,
                    };
                });
                this.setState({ fieldNames });
            }
        };
        this.onFieldSourceChange = (k, v) => {
            const mappings = this.props.mappings || {};
            const mapping = mappings[k] || {};
            this.props.change(Object.assign(Object.assign({}, mappings), { [k]: Object.assign(Object.assign({}, mapping), { source: v.value || AnnotationEventFieldSource.Field }) }));
        };
        this.onFieldNameChange = (k, v) => {
            const mappings = this.props.mappings || {};
            // in case of clearing the value
            if (!v) {
                const newMappings = Object.assign({}, this.props.mappings);
                delete newMappings[k];
                this.props.change(newMappings);
                return;
            }
            const mapping = mappings[k] || {};
            this.props.change(Object.assign(Object.assign({}, mappings), { [k]: Object.assign(Object.assign({}, mapping), { value: v.value, source: AnnotationEventFieldSource.Field }) }));
        };
        this.state = {
            fieldNames: [],
        };
    }
    componentDidMount() {
        this.updateFields();
    }
    componentDidUpdate(oldProps) {
        if (oldProps.response !== this.props.response) {
            this.updateFields();
        }
    }
    renderRow(row, mapping, first) {
        const { fieldNames } = this.state;
        let picker = [...fieldNames];
        const current = mapping.value;
        let currentValue = fieldNames.find((f) => current === f.value);
        if (current && !currentValue) {
            picker.push({
                label: current,
                value: current,
            });
        }
        let value = first ? first[row.key] : '';
        if (value && row.key.startsWith('time')) {
            const fmt = getValueFormat('dateTimeAsIso');
            value = formattedValueToString(fmt(value));
        }
        if (value === null || value === undefined) {
            value = ''; // empty string
        }
        return (React.createElement("tr", { key: row.key },
            React.createElement("td", null,
                row.label || row.key,
                ' ',
                row.help && (React.createElement(Tooltip, { content: row.help },
                    React.createElement(Icon, { name: "info-circle" })))),
            React.createElement("td", null,
                React.createElement(Select, { value: currentValue, options: picker, placeholder: row.placeholder || row.key, onChange: (v) => {
                        this.onFieldNameChange(row.key, v);
                    }, noOptionsMessage: "Unknown field names", allowCustomValue: true, isClearable: true })),
            React.createElement("td", null, `${value}`)));
    }
    render() {
        var _a, _b;
        const first = (_b = (_a = this.props.response) === null || _a === void 0 ? void 0 : _a.events) === null || _b === void 0 ? void 0 : _b[0];
        const mappings = this.props.mappings || {};
        return (React.createElement("table", { className: "filter-table" },
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null, "Annotation"),
                    React.createElement("th", null, "From"),
                    React.createElement("th", null, "First Value"))),
            React.createElement("tbody", null, annotationEventNames.map((row) => {
                return this.renderRow(row, mappings[row.key] || {}, first);
            }))));
    }
}
//# sourceMappingURL=AnnotationResultMapper.js.map