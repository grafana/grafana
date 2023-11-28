import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useContext } from 'react';
import { useForm } from 'react-hook-form';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { config, featureEnabled } from '@grafana/runtime/src';
import { ClipboardButton, Field, HorizontalGroup, Input, Label, ModalsContext, Switch, useStyles2, } from '@grafana/ui/src';
import { Layout } from '@grafana/ui/src/components/Layout/Layout';
import { getTimeRange } from 'app/features/dashboard/utils/timeRange';
import { contextSrv } from '../../../../../../core/services/context_srv';
import { AccessControlAction, useSelector } from '../../../../../../types';
import { DeletePublicDashboardButton } from '../../../../../manage-dashboards/components/PublicDashboardListTable/DeletePublicDashboardButton';
import { useGetPublicDashboardQuery, useUpdatePublicDashboardMutation } from '../../../../api/publicDashboardApi';
import { useIsDesktop } from '../../../../utils/screen';
import { ShareModal } from '../../ShareModal';
import { trackDashboardSharingActionPerType } from '../../analytics';
import { shareDashboardType } from '../../utils';
import { NoUpsertPermissionsAlert } from '../ModalAlerts/NoUpsertPermissionsAlert';
import { SaveDashboardChangesAlert } from '../ModalAlerts/SaveDashboardChangesAlert';
import { UnsupportedDataSourcesAlert } from '../ModalAlerts/UnsupportedDataSourcesAlert';
import { UnsupportedTemplateVariablesAlert } from '../ModalAlerts/UnsupportedTemplateVariablesAlert';
import { dashboardHasTemplateVariables, generatePublicDashboardUrl } from '../SharePublicDashboardUtils';
import { useGetUnsupportedDataSources } from '../useGetUnsupportedDataSources';
import { Configuration } from './Configuration';
import { EmailSharingConfiguration } from './EmailSharingConfiguration';
import { SettingsBar } from './SettingsBar';
import { SettingsSummary } from './SettingsSummary';
const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;
const ConfigPublicDashboard = () => {
    const styles = useStyles2(getStyles);
    const isDesktop = useIsDesktop();
    const { showModal, hideModal } = useContext(ModalsContext);
    const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);
    const hasEmailSharingEnabled = !!config.featureToggles.publicDashboardsEmailSharing && featureEnabled('publicDashboardsEmailSharing');
    const dashboardState = useSelector((store) => store.dashboard);
    const dashboard = dashboardState.getModel();
    const dashboardVariables = dashboard.getVariables();
    const { unsupportedDataSources } = useGetUnsupportedDataSources(dashboard);
    const { data: publicDashboard, isFetching: isGetLoading } = useGetPublicDashboardQuery(dashboard.uid);
    const [update, { isLoading: isUpdateLoading }] = useUpdatePublicDashboardMutation();
    const isDataLoading = isUpdateLoading || isGetLoading;
    const disableInputs = !hasWritePermissions || isDataLoading;
    const timeRange = getTimeRange(dashboard.getDefaultTime(), dashboard);
    const { handleSubmit, setValue, register } = useForm({
        defaultValues: {
            isAnnotationsEnabled: publicDashboard === null || publicDashboard === void 0 ? void 0 : publicDashboard.annotationsEnabled,
            isTimeSelectionEnabled: publicDashboard === null || publicDashboard === void 0 ? void 0 : publicDashboard.timeSelectionEnabled,
            isPaused: !(publicDashboard === null || publicDashboard === void 0 ? void 0 : publicDashboard.isEnabled),
        },
    });
    const onUpdate = (values) => __awaiter(void 0, void 0, void 0, function* () {
        const { isAnnotationsEnabled, isTimeSelectionEnabled, isPaused } = values;
        const req = {
            dashboard,
            payload: Object.assign(Object.assign({}, publicDashboard), { annotationsEnabled: isAnnotationsEnabled, timeSelectionEnabled: isTimeSelectionEnabled, isEnabled: !isPaused }),
        };
        update(req);
    });
    const onChange = (name, value) => __awaiter(void 0, void 0, void 0, function* () {
        setValue(name, value);
        yield handleSubmit((data) => onUpdate(data))();
    });
    const onDismissDelete = () => {
        showModal(ShareModal, {
            dashboard,
            onDismiss: hideModal,
            activeTab: shareDashboardType.publicDashboard,
        });
    };
    function onCopyURL() {
        trackDashboardSharingActionPerType('copy_public_url', shareDashboardType.publicDashboard);
    }
    return (React.createElement("div", { className: styles.configContainer },
        hasWritePermissions && dashboard.hasUnsavedChanges() && React.createElement(SaveDashboardChangesAlert, null),
        !hasWritePermissions && React.createElement(NoUpsertPermissionsAlert, { mode: "edit" }),
        dashboardHasTemplateVariables(dashboardVariables) && React.createElement(UnsupportedTemplateVariablesAlert, null),
        !!unsupportedDataSources.length && (React.createElement(UnsupportedDataSourcesAlert, { unsupportedDataSources: unsupportedDataSources.join(', ') })),
        hasEmailSharingEnabled && React.createElement(EmailSharingConfiguration, null),
        React.createElement(Field, { label: "Dashboard URL", className: styles.fieldSpace },
            React.createElement(Input, { value: generatePublicDashboardUrl(publicDashboard.accessToken), readOnly: true, disabled: !(publicDashboard === null || publicDashboard === void 0 ? void 0 : publicDashboard.isEnabled), "data-testid": selectors.CopyUrlInput, addonAfter: React.createElement(ClipboardButton, { "data-testid": selectors.CopyUrlButton, variant: "primary", disabled: !(publicDashboard === null || publicDashboard === void 0 ? void 0 : publicDashboard.isEnabled), getText: () => generatePublicDashboardUrl(publicDashboard.accessToken), onClipboardCopy: onCopyURL }, "Copy") })),
        React.createElement(Field, { className: styles.fieldSpace },
            React.createElement(Layout, null,
                React.createElement(Switch, Object.assign({}, register('isPaused'), { disabled: disableInputs, onChange: (e) => {
                        trackDashboardSharingActionPerType(e.currentTarget.checked ? 'disable_sharing' : 'enable_sharing', shareDashboardType.publicDashboard);
                        onChange('isPaused', e.currentTarget.checked);
                    }, "data-testid": selectors.PauseSwitch })),
                React.createElement(Label, { className: css `
              margin-bottom: 0;
            ` }, "Pause sharing dashboard"))),
        React.createElement(Field, { className: styles.fieldSpace },
            React.createElement(SettingsBar, { title: "Settings", headerElement: ({ className }) => (React.createElement(SettingsSummary, { className: className, isDataLoading: isDataLoading, timeRange: timeRange, timeSelectionEnabled: publicDashboard === null || publicDashboard === void 0 ? void 0 : publicDashboard.timeSelectionEnabled, annotationsEnabled: publicDashboard === null || publicDashboard === void 0 ? void 0 : publicDashboard.annotationsEnabled })), "data-testid": selectors.SettingsDropdown },
                React.createElement(Configuration, { disabled: disableInputs, onChange: onChange, register: register, timeRange: timeRange }))),
        React.createElement(Layout, { orientation: isDesktop ? 0 : 1, justify: isDesktop ? 'flex-end' : 'flex-start', align: isDesktop ? 'center' : 'normal' },
            React.createElement(HorizontalGroup, { justify: "flex-end" },
                React.createElement(DeletePublicDashboardButton, { type: "button", disabled: disableInputs, "data-testid": selectors.DeleteButton, onDismiss: onDismissDelete, variant: "destructive", fill: "outline", dashboard: dashboard, publicDashboard: {
                        uid: publicDashboard.uid,
                        dashboardUid: dashboard.uid,
                        title: dashboard.title,
                    } }, "Revoke public URL")))));
};
const getStyles = (theme) => ({
    configContainer: css `
    label: config container;
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
    gap: ${theme.spacing(3)};
  `,
    fieldSpace: css `
    label: field space;
    width: 100%;
    margin-bottom: 0;
  `,
    timeRange: css({
        display: 'inline-block',
    }),
});
export default ConfigPublicDashboard;
//# sourceMappingURL=ConfigPublicDashboard.js.map