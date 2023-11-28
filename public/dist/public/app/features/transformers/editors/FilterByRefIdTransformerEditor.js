import React from 'react';
import { DataTransformerID, standardTransformers, TransformerCategory, } from '@grafana/data';
import { HorizontalGroup, FilterPill, FieldValidationMessage } from '@grafana/ui';
export class FilterByRefIdTransformerEditor extends React.PureComponent {
    constructor(props) {
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
            this.setState({ selected });
            this.props.onChange(Object.assign(Object.assign({}, this.props.options), { include: selected.join('|') }));
        };
        this.state = {
            include: props.options.include || '',
            options: [],
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
        const { input, options } = this.props;
        const configuredOptions = options.include ? options.include.split('|') : [];
        const allNames = [];
        const byName = {};
        for (const frame of input) {
            if (frame.refId) {
                let v = byName[frame.refId];
                if (!v) {
                    v = byName[frame.refId] = {
                        refId: frame.refId,
                        count: 0,
                    };
                    allNames.push(v);
                }
                v.count++;
            }
        }
        if (configuredOptions.length) {
            const options = [];
            const selected = [];
            for (const v of allNames) {
                if (configuredOptions.includes(v.refId)) {
                    selected.push(v);
                }
                options.push(v);
            }
            this.setState({
                options,
                selected: selected.map((s) => s.refId),
            });
        }
        else {
            this.setState({ options: allNames, selected: [] });
        }
    }
    render() {
        const { options, selected } = this.state;
        const { input } = this.props;
        return (React.createElement(React.Fragment, null,
            input.length <= 1 && (React.createElement("div", null,
                React.createElement(FieldValidationMessage, null, "Filter data by query expects multiple queries in the input."))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement("div", { className: "gf-form-label width-8" }, "Series refId"),
                    React.createElement(HorizontalGroup, { spacing: "xs", align: "flex-start", wrap: true }, options.map((o, i) => {
                        const label = `${o.refId}${o.count > 1 ? ' (' + o.count + ')' : ''}`;
                        const isSelected = selected.indexOf(o.refId) > -1;
                        return (React.createElement(FilterPill, { key: `${o.refId}/${i}`, onClick: () => {
                                this.onFieldToggle(o.refId);
                            }, label: label, selected: isSelected }));
                    }))))));
    }
}
export const filterFramesByRefIdTransformRegistryItem = {
    id: DataTransformerID.filterByRefId,
    editor: FilterByRefIdTransformerEditor,
    transformation: standardTransformers.filterFramesByRefIdTransformer,
    name: 'Filter data by query',
    description: 'Filter data by query. This is useful if you are sharing the results from a different panel that has many queries and you want to only visualize a subset of that in this panel.',
    categories: new Set([TransformerCategory.Filter]),
};
//# sourceMappingURL=FilterByRefIdTransformerEditor.js.map