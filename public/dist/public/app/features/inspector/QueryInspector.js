import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { Subscription } from 'rxjs';
import { LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Stack } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Button, ClipboardButton, JSONFormatter, LoadingPlaceholder } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { backendSrv } from 'app/core/services/backend_srv';
import { getPanelInspectorStyles } from './styles';
export class QueryInspector extends PureComponent {
    constructor(props) {
        super(props);
        this.subs = new Subscription();
        this.setFormattedJson = (formattedJson) => {
            this.formattedJson = formattedJson;
        };
        this.getTextForClipboard = () => {
            return JSON.stringify(this.formattedJson, null, 2);
        };
        this.onToggleExpand = () => {
            this.setState((prevState) => (Object.assign(Object.assign({}, prevState), { allNodesExpanded: !this.state.allNodesExpanded })));
        };
        this.onToggleMocking = () => {
            this.setState((prevState) => (Object.assign(Object.assign({}, prevState), { isMocking: !this.state.isMocking })));
        };
        this.getNrOfOpenNodes = () => {
            if (this.state.allNodesExpanded === null) {
                return 3; // 3 is default, ie when state is null
            }
            else if (this.state.allNodesExpanded) {
                return 20;
            }
            return 1;
        };
        this.state = {
            executedQueries: [],
            allNodesExpanded: null,
            isMocking: false,
            mockedResponse: '',
            response: {},
        };
    }
    componentDidMount() {
        this.subs.add(backendSrv.getInspectorStream().subscribe({
            next: (response) => this.onDataSourceResponse(response),
        }));
    }
    componentDidUpdate(oldProps) {
        if (this.props.data !== oldProps.data) {
            this.updateQueryList();
        }
    }
    /**
     * Find the list of executed queries
     */
    updateQueryList() {
        const { data } = this.props;
        const frames = data.series;
        const executedQueries = [];
        if (frames === null || frames === void 0 ? void 0 : frames.length) {
            let last = undefined;
            frames.forEach((frame, idx) => {
                var _a;
                const query = (_a = frame.meta) === null || _a === void 0 ? void 0 : _a.executedQueryString;
                if (query) {
                    const refId = frame.refId || '?';
                    if ((last === null || last === void 0 ? void 0 : last.refId) === refId) {
                        last.frames++;
                        last.rows += frame.length;
                    }
                    else {
                        last = {
                            refId,
                            frames: 0,
                            rows: frame.length,
                            query,
                        };
                        executedQueries.push(last);
                    }
                }
            });
        }
        this.setState({ executedQueries });
    }
    componentWillUnmount() {
        this.subs.unsubscribe();
    }
    onDataSourceResponse(response) {
        var _a;
        // ignore silent requests
        if ((_a = response.config) === null || _a === void 0 ? void 0 : _a.hideFromInspector) {
            return;
        }
        response = Object.assign({}, response); // clone - dont modify the response
        if (response.headers) {
            delete response.headers;
        }
        if (response.config) {
            response.request = response.config;
            delete response.config;
            delete response.request.transformRequest;
            delete response.request.transformResponse;
            delete response.request.paramSerializer;
            delete response.request.jsonpCallbackParam;
            delete response.request.headers;
            delete response.request.requestId;
            delete response.request.inspect;
            delete response.request.retry;
            delete response.request.timeout;
        }
        if (response.data) {
            response.response = response.data;
            delete response.config;
            delete response.data;
            delete response.status;
            delete response.statusText;
            delete response.ok;
            delete response.url;
            delete response.redirected;
            delete response.type;
            delete response.$$config;
        }
        this.setState({
            response: response,
        });
    }
    renderExecutedQueries(executedQueries) {
        if (!executedQueries.length) {
            return null;
        }
        const styles = {
            refId: css `
        font-weight: ${config.theme.typography.weight.semibold};
        color: ${config.theme.colors.textBlue};
        margin-right: 8px;
      `,
        };
        return (React.createElement("div", null, executedQueries.map((info) => {
            return (React.createElement(Stack, { key: info.refId, gap: 1, direction: "column" },
                React.createElement("div", null,
                    React.createElement("span", { className: styles.refId },
                        info.refId,
                        ":"),
                    info.frames > 1 && React.createElement("span", null,
                        info.frames,
                        " frames, "),
                    React.createElement("span", null,
                        info.rows,
                        " rows")),
                React.createElement("pre", null, info.query)));
        })));
    }
    render() {
        const { allNodesExpanded, executedQueries, response } = this.state;
        const { onRefreshQuery, data } = this.props;
        const openNodes = this.getNrOfOpenNodes();
        const styles = getPanelInspectorStyles();
        const haveData = Object.keys(response).length > 0;
        const isLoading = data.state === LoadingState.Loading;
        return (React.createElement("div", { className: styles.wrap },
            React.createElement("div", { "aria-label": selectors.components.PanelInspector.Query.content },
                React.createElement("h3", { className: "section-heading" }, "Query inspector"),
                React.createElement("p", { className: "small muted" },
                    React.createElement(Trans, { i18nKey: "inspector.query.description" }, "Query inspector allows you to view raw request and response. To collect this data Grafana needs to issue a new query. Click refresh button below to trigger a new query."))),
            this.renderExecutedQueries(executedQueries),
            React.createElement("div", { className: styles.toolbar },
                React.createElement(Button, { icon: "sync", onClick: onRefreshQuery, "aria-label": selectors.components.PanelInspector.Query.refreshButton },
                    React.createElement(Trans, { i18nKey: "inspector.query.refresh" }, "Refresh")),
                haveData && allNodesExpanded && (React.createElement(Button, { icon: "minus", variant: "secondary", className: styles.toolbarItem, onClick: this.onToggleExpand },
                    React.createElement(Trans, { i18nKey: "inspector.query.collapse-all" }, "Collapse all"))),
                haveData && !allNodesExpanded && (React.createElement(Button, { icon: "plus", variant: "secondary", className: styles.toolbarItem, onClick: this.onToggleExpand },
                    React.createElement(Trans, { i18nKey: "inspector.query.expand-all" }, "Expand all"))),
                haveData && (React.createElement(ClipboardButton, { getText: this.getTextForClipboard, className: styles.toolbarItem, icon: "copy", variant: "secondary" },
                    React.createElement(Trans, { i18nKey: "inspector.query.copy-to-clipboard" }, "Copy to clipboard"))),
                React.createElement("div", { className: "flex-grow-1" })),
            React.createElement("div", { className: styles.content },
                isLoading && React.createElement(LoadingPlaceholder, { text: "Loading query inspector..." }),
                !isLoading && haveData && (React.createElement(JSONFormatter, { json: response, open: openNodes, onDidRender: this.setFormattedJson })),
                !isLoading && !haveData && (React.createElement("p", { className: "muted" },
                    React.createElement(Trans, { i18nKey: "inspector.query.no-data" }, "No request and response collected yet. Hit refresh button"))))));
    }
}
//# sourceMappingURL=QueryInspector.js.map