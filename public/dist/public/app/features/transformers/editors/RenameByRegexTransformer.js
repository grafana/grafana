import { css } from '@emotion/css';
import React from 'react';
import { DataTransformerID, standardTransformers, stringToJsRegex, TransformerCategory, } from '@grafana/data';
import { Field, Input } from '@grafana/ui';
export class RenameByRegexTransformerEditor extends React.PureComponent {
    constructor(props) {
        super(props);
        this.handleRegexChange = (e) => {
            const regex = e.currentTarget.value;
            let isRegexValid = true;
            if (regex) {
                try {
                    if (regex) {
                        stringToJsRegex(regex);
                    }
                }
                catch (e) {
                    isRegexValid = false;
                }
            }
            this.setState((previous) => (Object.assign(Object.assign({}, previous), { regex, isRegexValid })));
        };
        this.handleRenameChange = (e) => {
            const renamePattern = e.currentTarget.value;
            this.setState((previous) => (Object.assign(Object.assign({}, previous), { renamePattern })));
        };
        this.handleRegexBlur = (e) => {
            const regex = e.currentTarget.value;
            let isRegexValid = true;
            try {
                if (regex) {
                    stringToJsRegex(regex);
                }
            }
            catch (e) {
                isRegexValid = false;
            }
            this.setState({ isRegexValid }, () => {
                if (isRegexValid) {
                    this.props.onChange(Object.assign(Object.assign({}, this.props.options), { regex }));
                }
            });
        };
        this.handleRenameBlur = (e) => {
            const renamePattern = e.currentTarget.value;
            this.setState({ renamePattern }, () => this.props.onChange(Object.assign(Object.assign({}, this.props.options), { renamePattern })));
        };
        this.state = {
            regex: props.options.regex,
            renamePattern: props.options.renamePattern,
            isRegexValid: true,
        };
    }
    render() {
        const { regex, renamePattern, isRegexValid } = this.state;
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement("div", { className: "gf-form-label width-8" }, "Match"),
                    React.createElement(Field, { invalid: !isRegexValid, error: !isRegexValid ? 'Invalid pattern' : undefined, className: css `
                margin-bottom: 0;
              ` },
                        React.createElement(Input, { placeholder: "Regular expression pattern", value: regex || '', onChange: this.handleRegexChange, onBlur: this.handleRegexBlur, width: 25 })))),
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement("div", { className: "gf-form-label width-8" }, "Replace"),
                    React.createElement(Field, { className: css `
                margin-bottom: 0;
              ` },
                        React.createElement(Input, { placeholder: "Replacement pattern", value: renamePattern || '', onChange: this.handleRenameChange, onBlur: this.handleRenameBlur, width: 25 }))))));
    }
}
export const renameByRegexTransformRegistryItem = {
    id: DataTransformerID.renameByRegex,
    editor: RenameByRegexTransformerEditor,
    transformation: standardTransformers.renameByRegexTransformer,
    name: 'Rename by regex',
    description: 'Renames part of the query result by using regular expression with placeholders.',
    categories: new Set([TransformerCategory.ReorderAndRename]),
};
//# sourceMappingURL=RenameByRegexTransformer.js.map