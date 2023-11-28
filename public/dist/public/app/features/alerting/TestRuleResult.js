import { __awaiter } from "tslib";
import React, { PureComponent } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { LoadingPlaceholder, JSONFormatter, Icon, HorizontalGroup, ClipboardButton, clearButtonStyles, withTheme2, } from '@grafana/ui';
class UnThemedTestRuleResult extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            isLoading: false,
            allNodesExpanded: null,
            testRuleResponse: {},
        };
        this.setFormattedJson = (formattedJson) => {
            this.formattedJson = formattedJson;
        };
        this.getTextForClipboard = () => {
            return JSON.stringify(this.formattedJson, null, 2);
        };
        this.onToggleExpand = () => {
            this.setState((prevState) => (Object.assign(Object.assign({}, prevState), { allNodesExpanded: !this.state.allNodesExpanded })));
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
        this.renderExpandCollapse = () => {
            const { allNodesExpanded } = this.state;
            const collapse = (React.createElement(React.Fragment, null,
                React.createElement(Icon, { name: "minus-circle" }),
                " Collapse All"));
            const expand = (React.createElement(React.Fragment, null,
                React.createElement(Icon, { name: "plus-circle" }),
                " Expand All"));
            return allNodesExpanded ? collapse : expand;
        };
    }
    componentDidMount() {
        this.testRule();
    }
    testRule() {
        return __awaiter(this, void 0, void 0, function* () {
            const { dashboard, panel } = this.props;
            // dashboard save model
            const model = dashboard.getSaveModelCloneOld();
            // now replace panel to get current edits
            model.panels = model.panels.map((dashPanel) => {
                return dashPanel.id === panel.id ? panel.getSaveModel() : dashPanel;
            });
            const payload = { dashboard: model, panelId: panel.id };
            this.setState({ isLoading: true });
            const testRuleResponse = yield getBackendSrv().post(`/api/alerts/test`, payload);
            this.setState({ isLoading: false, testRuleResponse });
        });
    }
    render() {
        const { testRuleResponse, isLoading } = this.state;
        const clearButton = clearButtonStyles(this.props.theme);
        if (isLoading === true) {
            return React.createElement(LoadingPlaceholder, { text: "Evaluating rule" });
        }
        const openNodes = this.getNrOfOpenNodes();
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "pull-right" },
                React.createElement(HorizontalGroup, { spacing: "md" },
                    React.createElement("button", { type: "button", className: clearButton, onClick: this.onToggleExpand }, this.renderExpandCollapse()),
                    React.createElement(ClipboardButton, { getText: this.getTextForClipboard, icon: "copy" }, "Copy to Clipboard"))),
            React.createElement(JSONFormatter, { json: testRuleResponse, open: openNodes, onDidRender: this.setFormattedJson })));
    }
}
export const TestRuleResult = withTheme2(UnThemedTestRuleResult);
//# sourceMappingURL=TestRuleResult.js.map