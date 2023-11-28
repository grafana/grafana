import { css } from '@emotion/css';
import React from 'react';
import { Icon, useStyles2 } from '@grafana/ui';
import { makeDashboardLink, makePanelLink } from '../../utils/misc';
const DashboardAnnotationField = ({ dashboard, panel, dashboardUid, panelId, onEditClick, onDeleteClick, }) => {
    var _a;
    const styles = useStyles2(getStyles);
    const dashboardLink = makeDashboardLink((dashboard === null || dashboard === void 0 ? void 0 : dashboard.uid) || dashboardUid);
    const panelLink = makePanelLink((dashboard === null || dashboard === void 0 ? void 0 : dashboard.uid) || dashboardUid, ((_a = panel === null || panel === void 0 ? void 0 : panel.id) === null || _a === void 0 ? void 0 : _a.toString()) || panelId);
    return (React.createElement("div", { className: styles.container },
        dashboard && (React.createElement("a", { href: dashboardLink, className: styles.link, target: "_blank", rel: "noreferrer", "data-testid": "dashboard-annotation" },
            dashboard.title,
            " ",
            React.createElement(Icon, { name: 'external-link-alt' }))),
        !dashboard && React.createElement("span", { className: styles.noLink },
            "Dashboard ",
            dashboardUid,
            " "),
        panel && (React.createElement("a", { href: panelLink, className: styles.link, target: "_blank", rel: "noreferrer", "data-testid": "panel-annotation" },
            panel.title || '<No title>',
            " ",
            React.createElement(Icon, { name: 'external-link-alt' }))),
        !panel && React.createElement("span", { className: styles.noLink },
            " - Panel ",
            panelId),
        (dashboard || panel) && (React.createElement(React.Fragment, null,
            React.createElement(Icon, { name: 'pen', onClick: onEditClick, className: styles.icon }),
            React.createElement(Icon, { name: 'trash-alt', onClick: onDeleteClick, className: styles.icon })))));
};
const getStyles = (theme) => ({
    container: css `
    margin-top: 5px;
  `,
    noLink: css `
    color: ${theme.colors.text.secondary};
  `,
    link: css `
    color: ${theme.colors.text.link};
    margin-right: ${theme.spacing(1.5)};
  `,
    icon: css `
    margin-right: ${theme.spacing(1)};
    cursor: pointer;
  `,
});
export default DashboardAnnotationField;
//# sourceMappingURL=DashboardAnnotationField.js.map