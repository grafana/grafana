import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useState } from 'react';
import { config } from '@grafana/runtime';
import { Button, CodeEditor, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { Trans } from 'app/core/internationalization';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { getDashboardSrv } from '../../services/DashboardSrv';
export function JsonEditorSettings({ dashboard, sectionNav }) {
    const [dashboardJson, setDashboardJson] = useState(JSON.stringify(dashboard.getSaveModelClone(), null, 2));
    const pageNav = config.featureToggles.dockedMegaMenu ? sectionNav.node.parentItem : undefined;
    const onClick = () => __awaiter(this, void 0, void 0, function* () {
        yield getDashboardSrv().saveJSONDashboard(dashboardJson);
        dashboardWatcher.reloadPage();
    });
    const styles = useStyles2(getStyles);
    return (React.createElement(Page, { navModel: sectionNav, pageNav: pageNav },
        React.createElement("div", { className: styles.wrapper },
            React.createElement(Trans, { i18nKey: "dashboard-settings.json-editor.subtitle" }, "The JSON model below is the data structure that defines the dashboard. This includes dashboard settings, panel settings, layout, queries, and so on."),
            React.createElement(CodeEditor, { value: dashboardJson, language: "json", showMiniMap: true, showLineNumbers: true, onBlur: setDashboardJson, containerStyles: styles.codeEditor }),
            dashboard.meta.canSave && (React.createElement("div", null,
                React.createElement(Button, { type: "submit", onClick: onClick },
                    React.createElement(Trans, { i18nKey: "dashboard-settings.json-editor.save-button" }, "Save changes")))))));
}
const getStyles = (theme) => ({
    wrapper: css({
        display: 'flex',
        height: '100%',
        flexDirection: 'column',
        gap: theme.spacing(2),
    }),
    codeEditor: css({
        flexGrow: 1,
    }),
});
//# sourceMappingURL=JsonEditorSettings.js.map