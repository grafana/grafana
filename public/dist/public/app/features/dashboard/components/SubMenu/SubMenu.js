import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { stylesFactory, withTheme2 } from '@grafana/ui';
import { getSubMenuVariables, getVariablesState } from '../../../variables/state/selectors';
import { Annotations } from './Annotations';
import { DashboardLinks } from './DashboardLinks';
import { SubMenuItems } from './SubMenuItems';
class SubMenuUnConnected extends PureComponent {
    constructor() {
        super(...arguments);
        this.onAnnotationStateChanged = (updatedAnnotation) => {
            // we're mutating dashboard state directly here until annotations are in Redux.
            for (let index = 0; index < this.props.dashboard.annotations.list.length; index++) {
                const annotation = this.props.dashboard.annotations.list[index];
                if (annotation.name === updatedAnnotation.name) {
                    annotation.enable = !annotation.enable;
                    break;
                }
            }
            this.props.dashboard.startRefresh();
            this.forceUpdate();
        };
        this.disableSubmitOnEnter = (e) => {
            e.preventDefault();
        };
    }
    render() {
        var _a;
        const { dashboard, variables, links, annotations, theme } = this.props;
        const styles = getStyles(theme);
        if (!dashboard.isSubMenuVisible()) {
            return null;
        }
        const readOnlyVariables = (_a = dashboard.meta.isSnapshot) !== null && _a !== void 0 ? _a : false;
        return (React.createElement("div", { className: styles.submenu },
            React.createElement("form", { "aria-label": "Template variables", className: styles.formStyles, onSubmit: this.disableSubmitOnEnter },
                React.createElement(SubMenuItems, { variables: variables, readOnly: readOnlyVariables })),
            React.createElement(Annotations, { annotations: annotations, onAnnotationChanged: this.onAnnotationStateChanged, events: dashboard.events }),
            React.createElement("div", { className: styles.spacer }),
            dashboard && React.createElement(DashboardLinks, { dashboard: dashboard, links: links })));
    }
}
const mapStateToProps = (state, ownProps) => {
    const { uid } = ownProps.dashboard;
    const templatingState = getVariablesState(uid, state);
    return {
        variables: getSubMenuVariables(uid, templatingState.variables),
    };
};
const getStyles = stylesFactory((theme) => {
    return {
        formStyles: css `
      display: flex;
      flex-wrap: wrap;
      display: contents;
    `,
        submenu: css `
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-content: flex-start;
      align-items: flex-start;
      gap: ${theme.spacing(1)} ${theme.spacing(2)};
      padding: 0 0 ${theme.spacing(1)} 0;
    `,
        spacer: css({
            flexGrow: 1,
        }),
    };
});
export const SubMenu = withTheme2(connect(mapStateToProps)(SubMenuUnConnected));
SubMenu.displayName = 'SubMenu';
//# sourceMappingURL=SubMenu.js.map