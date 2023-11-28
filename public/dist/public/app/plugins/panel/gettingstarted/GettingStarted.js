import { __awaiter } from "tslib";
// Libraries
import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';
import { config } from '@grafana/runtime';
import { Button, Spinner, stylesFactory } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { Step } from './components/Step';
import { getSteps } from './steps';
export class GettingStarted extends PureComponent {
    constructor() {
        super(...arguments);
        this.state = {
            checksDone: false,
            currentStep: 0,
            steps: getSteps(),
        };
        this.onForwardClick = () => {
            this.setState((prevState) => ({
                currentStep: prevState.currentStep + 1,
            }));
        };
        this.onPreviousClick = () => {
            this.setState((prevState) => ({
                currentStep: prevState.currentStep - 1,
            }));
        };
        this.dismiss = () => {
            const { id } = this.props;
            const dashboard = getDashboardSrv().getCurrent();
            const panel = dashboard === null || dashboard === void 0 ? void 0 : dashboard.getPanelById(id);
            dashboard === null || dashboard === void 0 ? void 0 : dashboard.removePanel(panel);
            backendSrv.put('/api/user/helpflags/1', undefined, { showSuccessAlert: false }).then((res) => {
                contextSrv.user.helpFlags1 = res.helpFlags1;
            });
        };
    }
    componentDidMount() {
        return __awaiter(this, void 0, void 0, function* () {
            const { steps } = this.state;
            const checkedStepsPromises = steps.map((step) => __awaiter(this, void 0, void 0, function* () {
                const checkedCardsPromises = step.cards.map((card) => __awaiter(this, void 0, void 0, function* () {
                    return card.check().then((passed) => {
                        return Object.assign(Object.assign({}, card), { done: passed });
                    });
                }));
                const checkedCards = yield Promise.all(checkedCardsPromises);
                return Object.assign(Object.assign({}, step), { done: checkedCards.every((c) => c.done), cards: checkedCards });
            }));
            const checkedSteps = yield Promise.all(checkedStepsPromises);
            this.setState({
                currentStep: !checkedSteps[0].done ? 0 : 1,
                steps: checkedSteps,
                checksDone: true,
            });
        });
    }
    render() {
        const { checksDone, currentStep, steps } = this.state;
        const styles = getStyles();
        const step = steps[currentStep];
        return (React.createElement("div", { className: styles.container }, !checksDone ? (React.createElement("div", { className: styles.loading },
            React.createElement("div", { className: styles.loadingText }, "Checking completed setup steps"),
            React.createElement(Spinner, { size: 24, inline: true }))) : (React.createElement(React.Fragment, null,
            React.createElement(Button, { variant: "secondary", fill: "text", className: styles.dismiss, onClick: this.dismiss }, "Remove this panel"),
            currentStep === steps.length - 1 && (React.createElement(Button, { className: cx(styles.backForwardButtons, styles.previous), onClick: this.onPreviousClick, "aria-label": "To advanced tutorials", icon: "angle-left", variant: "secondary" })),
            React.createElement("div", { className: styles.content },
                React.createElement(Step, { step: step })),
            currentStep < steps.length - 1 && (React.createElement(Button, { className: cx(styles.backForwardButtons, styles.forward), onClick: this.onForwardClick, "aria-label": "To basic tutorials", icon: "angle-right", variant: "secondary" }))))));
    }
}
const getStyles = stylesFactory(() => {
    const theme = config.theme2;
    return {
        container: css `
      display: flex;
      flex-direction: column;
      height: 100%;
      // background: url(public/img/getting_started_bg_${theme.colors.mode}.svg) no-repeat;
      background-size: cover;
      padding: ${theme.spacing(4)} ${theme.spacing(2)} 0;
    `,
        content: css `
      label: content;
      display: flex;
      justify-content: center;

      ${theme.breakpoints.down('xxl')} {
        margin-left: ${theme.spacing(3)};
        justify-content: flex-start;
      }
    `,
        header: css `
      label: header;
      margin-bottom: ${theme.spacing(3)};
      display: flex;
      flex-direction: column;

      ${theme.breakpoints.down('lg')} {
        flex-direction: row;
      }
    `,
        headerLogo: css `
      height: 58px;
      padding-right: ${theme.spacing(2)};
      display: none;

      ${theme.breakpoints.up('md')} {
        display: block;
      }
    `,
        heading: css `
      label: heading;
      margin-right: ${theme.spacing(3)};
      margin-bottom: ${theme.spacing(3)};
      flex-grow: 1;
      display: flex;

      ${theme.breakpoints.up('md')} {
        margin-bottom: 0;
      }
    `,
        backForwardButtons: css `
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
    `,
        previous: css `
      left: 10px;

      ${theme.breakpoints.down('md')} {
        left: 0;
      }
    `,
        forward: css `
      right: 10px;

      ${theme.breakpoints.down('md')} {
        right: 0;
      }
    `,
        dismiss: css `
      align-self: flex-end;
      text-decoration: underline;
      margin-bottom: ${theme.spacing(1)};
    `,
        loading: css `
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%;
    `,
        loadingText: css `
      margin-right: ${theme.spacing(1)};
    `,
    };
});
//# sourceMappingURL=GettingStarted.js.map