import { __assign, __awaiter, __extends, __generator, __makeTemplateObject } from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import { Button, Spinner, stylesFactory } from '@grafana/ui';
import { config } from '@grafana/runtime';
import { css, cx } from '@emotion/css';
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { Step } from './components/Step';
import { getSteps } from './steps';
var GettingStarted = /** @class */ (function (_super) {
    __extends(GettingStarted, _super);
    function GettingStarted() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            checksDone: false,
            currentStep: 0,
            steps: getSteps(),
        };
        _this.onForwardClick = function () {
            _this.setState(function (prevState) { return ({
                currentStep: prevState.currentStep + 1,
            }); });
        };
        _this.onPreviousClick = function () {
            _this.setState(function (prevState) { return ({
                currentStep: prevState.currentStep - 1,
            }); });
        };
        _this.dismiss = function () {
            var id = _this.props.id;
            var dashboard = getDashboardSrv().getCurrent();
            var panel = dashboard === null || dashboard === void 0 ? void 0 : dashboard.getPanelById(id);
            dashboard === null || dashboard === void 0 ? void 0 : dashboard.removePanel(panel);
            backendSrv
                .request({
                method: 'PUT',
                url: '/api/user/helpflags/1',
                showSuccessAlert: false,
            })
                .then(function (res) {
                contextSrv.user.helpFlags1 = res.helpFlags1;
            });
        };
        return _this;
    }
    GettingStarted.prototype.componentDidMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            var steps, checkedStepsPromises, checkedSteps;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        steps = this.state.steps;
                        checkedStepsPromises = steps.map(function (step) { return __awaiter(_this, void 0, void 0, function () {
                            var checkedCardsPromises, checkedCards;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        checkedCardsPromises = step.cards.map(function (card) {
                                            return card.check().then(function (passed) {
                                                return __assign(__assign({}, card), { done: passed });
                                            });
                                        });
                                        return [4 /*yield*/, Promise.all(checkedCardsPromises)];
                                    case 1:
                                        checkedCards = _a.sent();
                                        return [2 /*return*/, __assign(__assign({}, step), { done: checkedCards.every(function (c) { return c.done; }), cards: checkedCards })];
                                }
                            });
                        }); });
                        return [4 /*yield*/, Promise.all(checkedStepsPromises)];
                    case 1:
                        checkedSteps = _a.sent();
                        this.setState({
                            currentStep: !checkedSteps[0].done ? 0 : 1,
                            steps: checkedSteps,
                            checksDone: true,
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    GettingStarted.prototype.render = function () {
        var _a = this.state, checksDone = _a.checksDone, currentStep = _a.currentStep, steps = _a.steps;
        var styles = getStyles();
        var step = steps[currentStep];
        return (React.createElement("div", { className: styles.container }, !checksDone ? (React.createElement("div", { className: styles.loading },
            React.createElement("div", { className: styles.loadingText }, "Checking completed setup steps"),
            React.createElement(Spinner, { size: 24, inline: true }))) : (React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.dismiss },
                React.createElement("div", { onClick: this.dismiss }, "Remove this panel")),
            currentStep === steps.length - 1 && (React.createElement("div", { className: cx(styles.backForwardButtons, styles.previous), onClick: this.onPreviousClick },
                React.createElement(Button, { "aria-label": "To advanced tutorials", icon: "angle-left", variant: "secondary" }))),
            React.createElement("div", { className: styles.content },
                React.createElement(Step, { step: step })),
            currentStep < steps.length - 1 && (React.createElement("div", { className: cx(styles.backForwardButtons, styles.forward), onClick: this.onForwardClick },
                React.createElement(Button, { "aria-label": "To basic tutorials", icon: "angle-right", variant: "secondary" })))))));
    };
    return GettingStarted;
}(PureComponent));
export { GettingStarted };
var getStyles = stylesFactory(function () {
    var theme = config.theme;
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n      flex-direction: column;\n      height: 100%;\n      // background: url(public/img/getting_started_bg_", ".svg) no-repeat;\n      background-size: cover;\n      padding: ", " ", " 0;\n    "], ["\n      display: flex;\n      flex-direction: column;\n      height: 100%;\n      // background: url(public/img/getting_started_bg_", ".svg) no-repeat;\n      background-size: cover;\n      padding: ", " ", " 0;\n    "])), theme.type, theme.spacing.xl, theme.spacing.md),
        content: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: content;\n      display: flex;\n      justify-content: center;\n\n      @media only screen and (max-width: ", ") {\n        margin-left: ", ";\n        justify-content: flex-start;\n      }\n    "], ["\n      label: content;\n      display: flex;\n      justify-content: center;\n\n      @media only screen and (max-width: ", ") {\n        margin-left: ", ";\n        justify-content: flex-start;\n      }\n    "])), theme.breakpoints.xxl, theme.spacing.lg),
        header: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      label: header;\n      margin-bottom: ", ";\n      display: flex;\n      flex-direction: column;\n\n      @media only screen and (min-width: ", ") {\n        flex-direction: row;\n      }\n    "], ["\n      label: header;\n      margin-bottom: ", ";\n      display: flex;\n      flex-direction: column;\n\n      @media only screen and (min-width: ", ") {\n        flex-direction: row;\n      }\n    "])), theme.spacing.lg, theme.breakpoints.lg),
        headerLogo: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      height: 58px;\n      padding-right: ", ";\n      display: none;\n\n      @media only screen and (min-width: ", ") {\n        display: block;\n      }\n    "], ["\n      height: 58px;\n      padding-right: ", ";\n      display: none;\n\n      @media only screen and (min-width: ", ") {\n        display: block;\n      }\n    "])), theme.spacing.md, theme.breakpoints.md),
        heading: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      label: heading;\n      margin-right: ", ";\n      margin-bottom: ", ";\n      flex-grow: 1;\n      display: flex;\n\n      @media only screen and (min-width: ", ") {\n        margin-bottom: 0;\n      }\n    "], ["\n      label: heading;\n      margin-right: ", ";\n      margin-bottom: ", ";\n      flex-grow: 1;\n      display: flex;\n\n      @media only screen and (min-width: ", ") {\n        margin-bottom: 0;\n      }\n    "])), theme.spacing.lg, theme.spacing.lg, theme.breakpoints.md),
        backForwardButtons: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      position: absolute;\n      bottom: 50%;\n      top: 50%;\n      height: 50px;\n    "], ["\n      position: absolute;\n      bottom: 50%;\n      top: 50%;\n      height: 50px;\n    "]))),
        previous: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      left: 10px;\n\n      @media only screen and (max-width: ", ") {\n        left: 0;\n      }\n    "], ["\n      left: 10px;\n\n      @media only screen and (max-width: ", ") {\n        left: 0;\n      }\n    "])), theme.breakpoints.md),
        forward: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      right: 10px;\n\n      @media only screen and (max-width: ", ") {\n        right: 0;\n      }\n    "], ["\n      right: 10px;\n\n      @media only screen and (max-width: ", ") {\n        right: 0;\n      }\n    "])), theme.breakpoints.md),
        dismiss: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      display: flex;\n      justify-content: flex-end;\n      cursor: pointer;\n      text-decoration: underline;\n      margin-right: ", ";\n      margin-bottom: ", ";\n    "], ["\n      display: flex;\n      justify-content: flex-end;\n      cursor: pointer;\n      text-decoration: underline;\n      margin-right: ", ";\n      margin-bottom: ", ";\n    "])), theme.spacing.md, theme.spacing.sm),
        loading: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n      display: flex;\n      justify-content: center;\n      align-items: center;\n      height: 100%;\n    "], ["\n      display: flex;\n      justify-content: center;\n      align-items: center;\n      height: 100%;\n    "]))),
        loadingText: css(templateObject_11 || (templateObject_11 = __makeTemplateObject(["\n      margin-right: ", ";\n    "], ["\n      margin-right: ", ";\n    "])), theme.spacing.sm),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11;
//# sourceMappingURL=GettingStarted.js.map