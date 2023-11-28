import { __awaiter } from "tslib";
import React from 'react';
import { shouldRefreshLabels } from '../languageUtils';
import { MonacoQueryFieldWrapper } from './monaco-query-field/MonacoQueryFieldWrapper';
export class LokiQueryField extends React.PureComponent {
    constructor(props) {
        super(props);
        this._isMounted = false;
        this.onChangeQuery = (value, override) => {
            // Send text change to parent
            const { query, onChange, onRunQuery } = this.props;
            if (onChange) {
                const nextQuery = Object.assign(Object.assign({}, query), { expr: value });
                onChange(nextQuery);
                if (override && onRunQuery) {
                    onRunQuery();
                }
            }
        };
        this.state = { labelsLoaded: false };
    }
    componentDidMount() {
        return __awaiter(this, void 0, void 0, function* () {
            this._isMounted = true;
            yield this.props.datasource.languageProvider.start();
            if (this._isMounted) {
                this.setState({ labelsLoaded: true });
            }
        });
    }
    componentWillUnmount() {
        this._isMounted = false;
    }
    componentDidUpdate(prevProps) {
        const { range, datasource: { languageProvider }, } = this.props;
        const refreshLabels = shouldRefreshLabels(range, prevProps.range);
        // We want to refresh labels when range changes (we round up intervals to a minute)
        if (refreshLabels) {
            languageProvider.fetchLabels();
        }
    }
    render() {
        var _a, _b;
        const { ExtraFieldElement, query, datasource, history, onRunQuery } = this.props;
        const placeholder = (_a = this.props.placeholder) !== null && _a !== void 0 ? _a : 'Enter a Loki query (run with Shift+Enter)';
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form-inline gf-form-inline--xs-view-flex-column flex-grow-1", "data-testid": this.props['data-testid'] },
                React.createElement("div", { className: "gf-form--grow flex-shrink-1 min-width-15" },
                    React.createElement(MonacoQueryFieldWrapper, { datasource: datasource, history: history !== null && history !== void 0 ? history : [], onChange: this.onChangeQuery, onRunQuery: onRunQuery, initialValue: (_b = query.expr) !== null && _b !== void 0 ? _b : '', placeholder: placeholder }))),
            ExtraFieldElement));
    }
}
//# sourceMappingURL=LokiQueryField.js.map