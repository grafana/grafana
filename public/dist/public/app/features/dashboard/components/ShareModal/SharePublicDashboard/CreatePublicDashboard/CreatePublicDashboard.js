import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Button, Form, Spinner, useStyles2 } from '@grafana/ui/src';
import { contextSrv } from '../../../../../../core/services/context_srv';
import { AccessControlAction, useSelector } from '../../../../../../types';
import { useCreatePublicDashboardMutation } from '../../../../api/publicDashboardApi';
import { trackDashboardSharingActionPerType } from '../../analytics';
import { shareDashboardType } from '../../utils';
import { NoUpsertPermissionsAlert } from '../ModalAlerts/NoUpsertPermissionsAlert';
import { UnsupportedDataSourcesAlert } from '../ModalAlerts/UnsupportedDataSourcesAlert';
import { UnsupportedTemplateVariablesAlert } from '../ModalAlerts/UnsupportedTemplateVariablesAlert';
import { dashboardHasTemplateVariables } from '../SharePublicDashboardUtils';
import { useGetUnsupportedDataSources } from '../useGetUnsupportedDataSources';
import { AcknowledgeCheckboxes } from './AcknowledgeCheckboxes';
const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;
const CreatePublicDashboard = ({ isError }) => {
    const styles = useStyles2(getStyles);
    const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);
    const dashboardState = useSelector((store) => store.dashboard);
    const dashboard = dashboardState.getModel();
    const { unsupportedDataSources } = useGetUnsupportedDataSources(dashboard);
    const [createPublicDashboard, { isLoading: isSaveLoading }] = useCreatePublicDashboardMutation();
    const disableInputs = !hasWritePermissions || isSaveLoading || isError;
    const onCreate = () => __awaiter(void 0, void 0, void 0, function* () {
        trackDashboardSharingActionPerType('generate_public_url', shareDashboardType.publicDashboard);
        createPublicDashboard({ dashboard, payload: { isEnabled: true } });
    });
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", null,
            React.createElement("p", { className: styles.title }, "Welcome to public dashboards!"),
            React.createElement("p", { className: styles.description }, "Currently, we don\u2019t support template variables or frontend data sources")),
        !hasWritePermissions && React.createElement(NoUpsertPermissionsAlert, { mode: "create" }),
        dashboardHasTemplateVariables(dashboard.getVariables()) && React.createElement(UnsupportedTemplateVariablesAlert, null),
        !!unsupportedDataSources.length && (React.createElement(UnsupportedDataSourcesAlert, { unsupportedDataSources: unsupportedDataSources.join(', ') })),
        React.createElement(Form, { onSubmit: onCreate, validateOn: "onChange", maxWidth: "none" }, ({ register, formState: { isValid }, }) => (React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.checkboxes },
                React.createElement(AcknowledgeCheckboxes, { disabled: disableInputs, register: register })),
            React.createElement("div", { className: styles.buttonContainer },
                React.createElement(Button, { type: "submit", disabled: disableInputs || !isValid, "data-testid": selectors.CreateButton },
                    "Generate public URL ",
                    isSaveLoading && React.createElement(Spinner, { className: styles.loadingSpinner }))))))));
};
const getStyles = (theme) => ({
    container: css `
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(4)};
  `,
    title: css `
    font-size: ${theme.typography.h4.fontSize};
    margin: ${theme.spacing(0, 0, 2)};
  `,
    description: css `
    color: ${theme.colors.text.secondary};
    margin-bottom: ${theme.spacing(0)};
  `,
    checkboxes: css `
    margin: ${theme.spacing(0, 0, 4)};
  `,
    buttonContainer: css `
    display: flex;
    justify-content: end;
  `,
    loadingSpinner: css `
    margin-left: ${theme.spacing(1)};
  `,
});
export default CreatePublicDashboard;
//# sourceMappingURL=CreatePublicDashboard.js.map