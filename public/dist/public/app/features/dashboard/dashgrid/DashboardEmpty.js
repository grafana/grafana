import { css } from '@emotion/css';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { Button, useStyles2, Text } from '@grafana/ui';
import { Box, Flex } from '@grafana/ui/src/unstable';
import { Trans } from 'app/core/internationalization';
import { onAddLibraryPanel, onCreateNewPanel, onImportDashboard } from 'app/features/dashboard/utils/dashboard';
import { useDispatch, useSelector } from 'app/types';
import { setInitialDatasource } from '../state/reducers';
const DashboardEmpty = ({ dashboard, canCreate }) => {
    const styles = useStyles2(getStyles);
    const dispatch = useDispatch();
    const initialDatasource = useSelector((state) => state.dashboard.initialDatasource);
    return (React.createElement(Flex, { alignItems: "center", justifyContent: "center" },
        React.createElement("div", { className: styles.wrapper },
            React.createElement(Flex, { alignItems: "stretch", justifyContent: "center", gap: 4, direction: "column" },
                React.createElement(Box, { borderColor: "strong", borderStyle: "dashed", padding: 4 },
                    React.createElement(Flex, { direction: "column", alignItems: "center", gap: 2 },
                        React.createElement(Text, { element: "h1", textAlignment: "center", weight: "medium" },
                            React.createElement(Trans, { i18nKey: "dashboard.empty.add-visualization-header" }, "Start your new dashboard by adding a visualization")),
                        React.createElement(Box, { marginBottom: 2, paddingX: 4 },
                            React.createElement(Text, { element: "p", textAlignment: "center", color: "secondary" },
                                React.createElement(Trans, { i18nKey: "dashboard.empty.add-visualization-body" }, "Select a data source and then query and visualize your data with charts, stats and tables or create lists, markdowns and other widgets."))),
                        React.createElement(Button, { size: "lg", icon: "plus", "data-testid": selectors.pages.AddDashboard.itemButton('Create new panel button'), onClick: () => {
                                const id = onCreateNewPanel(dashboard, initialDatasource);
                                reportInteraction('dashboards_emptydashboard_clicked', { item: 'add_visualization' });
                                locationService.partial({ editPanel: id, firstPanel: true });
                                dispatch(setInitialDatasource(undefined));
                            }, disabled: !canCreate },
                            React.createElement(Trans, { i18nKey: "dashboard.empty.add-visualization-button" }, "Add visualization")))),
                React.createElement(Flex, { direction: { xs: 'column', md: 'row' }, wrap: "wrap", gap: 4 },
                    config.featureToggles.vizAndWidgetSplit && (React.createElement(Box, { borderColor: "strong", borderStyle: "dashed", padding: 3, grow: 1 },
                        React.createElement(Flex, { direction: "column", alignItems: "center", gap: 1 },
                            React.createElement(Text, { element: "h3", textAlignment: "center", weight: "medium" },
                                React.createElement(Trans, { i18nKey: "dashboard.empty.add-widget-header" }, "Add a widget")),
                            React.createElement(Box, { marginBottom: 2 },
                                React.createElement(Text, { element: "p", textAlignment: "center", color: "secondary" },
                                    React.createElement(Trans, { i18nKey: "dashboard.empty.add-widget-body" }, "Create lists, markdowns and other widgets"))),
                            React.createElement(Button, { icon: "plus", fill: "outline", "data-testid": selectors.pages.AddDashboard.itemButton('Create new widget button'), onClick: () => {
                                    reportInteraction('dashboards_emptydashboard_clicked', { item: 'add_widget' });
                                    locationService.partial({ addWidget: true });
                                }, disabled: !canCreate },
                                React.createElement(Trans, { i18nKey: "dashboard.empty.add-widget-button" }, "Add widget"))))),
                    React.createElement(Box, { borderColor: "strong", borderStyle: "dashed", padding: 3, grow: 1 },
                        React.createElement(Flex, { direction: "column", alignItems: "center", gap: 1 },
                            React.createElement(Text, { element: "h3", textAlignment: "center", weight: "medium" },
                                React.createElement(Trans, { i18nKey: "dashboard.empty.add-library-panel-header" }, "Import panel")),
                            React.createElement(Box, { marginBottom: 2 },
                                React.createElement(Text, { element: "p", textAlignment: "center", color: "secondary" },
                                    React.createElement(Trans, { i18nKey: "dashboard.empty.add-library-panel-body" }, "Add visualizations that are shared with other dashboards."))),
                            React.createElement(Button, { icon: "plus", fill: "outline", "data-testid": selectors.pages.AddDashboard.itemButton('Add a panel from the panel library button'), onClick: () => {
                                    reportInteraction('dashboards_emptydashboard_clicked', { item: 'import_from_library' });
                                    onAddLibraryPanel(dashboard);
                                }, disabled: !canCreate },
                                React.createElement(Trans, { i18nKey: "dashboard.empty.add-library-panel-button" }, "Add library panel")))),
                    React.createElement(Box, { borderColor: "strong", borderStyle: "dashed", padding: 3, grow: 1 },
                        React.createElement(Flex, { direction: "column", alignItems: "center", gap: 1 },
                            React.createElement(Text, { element: "h3", textAlignment: "center", weight: "medium" },
                                React.createElement(Trans, { i18nKey: "dashboard.empty.import-a-dashboard-header" }, "Import a dashboard")),
                            React.createElement(Box, { marginBottom: 2 },
                                React.createElement(Text, { element: "p", textAlignment: "center", color: "secondary" },
                                    React.createElement(Trans, { i18nKey: "dashboard.empty.import-a-dashboard-body" },
                                        "Import dashboards from files or",
                                        React.createElement("a", { href: "https://grafana.com/grafana/dashboards/" }, "grafana.com"),
                                        "."))),
                            React.createElement(Button, { icon: "upload", fill: "outline", "data-testid": selectors.pages.AddDashboard.itemButton('Import dashboard button'), onClick: () => {
                                    reportInteraction('dashboards_emptydashboard_clicked', { item: 'import_dashboard' });
                                    onImportDashboard();
                                }, disabled: !canCreate },
                                React.createElement(Trans, { i18nKey: "dashboard.empty.import-dashboard-button" }, "Import dashboard")))))))));
};
export default DashboardEmpty;
function getStyles(theme) {
    return {
        wrapper: css({
            label: 'dashboard-empty-wrapper',
            flexDirection: 'column',
            maxWidth: '890px',
            gap: theme.spacing.gridSize * 4,
            paddingTop: theme.spacing(2),
            [theme.breakpoints.up('sm')]: {
                paddingTop: theme.spacing(12),
            },
        }),
    };
}
//# sourceMappingURL=DashboardEmpty.js.map