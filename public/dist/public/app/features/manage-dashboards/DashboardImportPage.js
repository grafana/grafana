import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { AppEvents, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, Field, Form, HorizontalGroup, Input, Spinner, stylesFactory, TextArea, VerticalGroup, FileDropzone, withTheme2, FileDropzoneDefaultChildren, LinkButton, TextLink, Label, } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { t, Trans } from 'app/core/internationalization';
import { cleanUpAction } from '../../core/actions/cleanUp';
import { ImportDashboardOverview } from './components/ImportDashboardOverview';
import { fetchGcomDashboard, importDashboardJson } from './state/actions';
import { initialImportDashboardState } from './state/reducers';
import { validateDashboardJson, validateGcomDashboard } from './utils/validation';
const IMPORT_STARTED_EVENT_NAME = 'dashboard_import_loaded';
const JSON_PLACEHOLDER = `{
    "title": "Example - Repeating Dictionary variables",
    "uid": "_0HnEoN4z",
    "panels": [...]
    ...
}
`;
const mapStateToProps = (state) => ({
    loadingState: state.importDashboard.state,
});
const mapDispatchToProps = {
    fetchGcomDashboard,
    importDashboardJson,
    cleanUpAction,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
class UnthemedDashboardImport extends PureComponent {
    constructor(props) {
        super(props);
        // Do not display upload file list
        this.fileListRenderer = (file, removeFile) => null;
        this.onFileUpload = (result) => {
            reportInteraction(IMPORT_STARTED_EVENT_NAME, {
                import_source: 'json_uploaded',
            });
            try {
                this.props.importDashboardJson(JSON.parse(String(result)));
            }
            catch (error) {
                if (error instanceof Error) {
                    appEvents.emit(AppEvents.alertError, ['Import failed', 'JSON -> JS Serialization failed: ' + error.message]);
                }
                return;
            }
        };
        this.getDashboardFromJson = (formData) => {
            reportInteraction(IMPORT_STARTED_EVENT_NAME, {
                import_source: 'json_pasted',
            });
            this.props.importDashboardJson(JSON.parse(formData.dashboardJson));
        };
        this.getGcomDashboard = (formData) => {
            reportInteraction(IMPORT_STARTED_EVENT_NAME, {
                import_source: 'gcom',
            });
            let dashboardId;
            const match = /(^\d+$)|dashboards\/(\d+)/.exec(formData.gcomDashboard);
            if (match && match[1]) {
                dashboardId = match[1];
            }
            else if (match && match[2]) {
                dashboardId = match[2];
            }
            if (dashboardId) {
                this.props.fetchGcomDashboard(dashboardId);
            }
        };
        this.pageNav = {
            text: 'Import dashboard',
            subTitle: 'Import dashboard from file or Grafana.com',
        };
        const { gcomDashboardId } = this.props.queryParams;
        if (gcomDashboardId) {
            this.getGcomDashboard({ gcomDashboard: gcomDashboardId });
            return;
        }
    }
    componentWillUnmount() {
        this.props.cleanUpAction({ cleanupAction: (state) => (state.importDashboard = initialImportDashboardState) });
    }
    renderImportForm() {
        const styles = importStyles(this.props.theme);
        const GcomDashboardsLink = () => (React.createElement(TextLink, { variant: "bodySmall", href: "https://grafana.com/grafana/dashboards/", external: true }, "grafana.com/dashboards"));
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.option },
                React.createElement(FileDropzone, { options: { multiple: false, accept: ['.json', '.txt'] }, readAs: "readAsText", fileListRenderer: this.fileListRenderer, onLoad: this.onFileUpload },
                    React.createElement(FileDropzoneDefaultChildren, { primaryText: t('dashboard-import.file-dropzone.primary-text', 'Upload dashboard JSON file'), secondaryText: t('dashboard-import.file-dropzone.secondary-text', 'Drag and drop here or click to browse') }))),
            React.createElement("div", { className: styles.option },
                React.createElement(Form, { onSubmit: this.getGcomDashboard, defaultValues: { gcomDashboard: '' } }, ({ register, errors }) => (React.createElement(Field, { label: React.createElement(Label, { className: styles.labelWithLink, htmlFor: "url-input" },
                        React.createElement("span", null,
                            React.createElement(Trans, { i18nKey: "dashboard-import.gcom-field.label" },
                                "Find and import dashboards for common applications at ",
                                React.createElement(GcomDashboardsLink, null)))), invalid: !!errors.gcomDashboard, error: errors.gcomDashboard && errors.gcomDashboard.message },
                    React.createElement(Input, Object.assign({ id: "url-input", placeholder: t('dashboard-import.gcom-field.placeholder', 'Grafana.com dashboard URL or ID'), type: "text" }, register('gcomDashboard', {
                        required: t('dashboard-import.gcom-field.validation-required', 'A Grafana dashboard URL or ID is required'),
                        validate: validateGcomDashboard,
                    }), { addonAfter: React.createElement(Button, { type: "submit" },
                            React.createElement(Trans, { i18nKey: "dashboard-import.gcom-field.load-button" }, "Load")) })))))),
            React.createElement("div", { className: styles.option },
                React.createElement(Form, { onSubmit: this.getDashboardFromJson, defaultValues: { dashboardJson: '' } }, ({ register, errors }) => (React.createElement(React.Fragment, null,
                    React.createElement(Field, { label: t('dashboard-import.json-field.label', 'Import via dashboard JSON model'), invalid: !!errors.dashboardJson, error: errors.dashboardJson && errors.dashboardJson.message },
                        React.createElement(TextArea, Object.assign({}, register('dashboardJson', {
                            required: t('dashboard-import.json-field.validation-required', 'Need a dashboard JSON model'),
                            validate: validateDashboardJson,
                        }), { "data-testid": selectors.components.DashboardImportPage.textarea, id: "dashboard-json-textarea", rows: 10, placeholder: JSON_PLACEHOLDER }))),
                    React.createElement(HorizontalGroup, null,
                        React.createElement(Button, { type: "submit", "data-testid": selectors.components.DashboardImportPage.submit },
                            React.createElement(Trans, { i18nKey: "dashboard-import.form-actions.load" }, "Load")),
                        React.createElement(LinkButton, { variant: "secondary", href: `${config.appSubUrl}/dashboards` },
                            React.createElement(Trans, { i18nKey: "dashboard-import.form-actions.cancel" }, "Cancel")))))))));
    }
    render() {
        const { loadingState } = this.props;
        return (React.createElement(Page, { navId: "dashboards/browse", pageNav: this.pageNav },
            React.createElement(Page.Contents, null,
                loadingState === LoadingState.Loading && (React.createElement(VerticalGroup, { justify: "center" },
                    React.createElement(HorizontalGroup, { justify: "center" },
                        React.createElement(Spinner, { size: 32 })))),
                [LoadingState.Error, LoadingState.NotStarted].includes(loadingState) && this.renderImportForm(),
                loadingState === LoadingState.Done && React.createElement(ImportDashboardOverview, null))));
    }
}
const DashboardImportUnConnected = withTheme2(UnthemedDashboardImport);
const DashboardImport = connector(DashboardImportUnConnected);
DashboardImport.displayName = 'DashboardImport';
export default DashboardImport;
const importStyles = stylesFactory((theme) => {
    return {
        option: css `
      margin-bottom: ${theme.spacing(4)};
      max-width: 600px;
    `,
        labelWithLink: css `
      max-width: 100%;
    `,
        linkWithinLabel: css `
      font-size: inherit;
    `,
    };
});
//# sourceMappingURL=DashboardImportPage.js.map