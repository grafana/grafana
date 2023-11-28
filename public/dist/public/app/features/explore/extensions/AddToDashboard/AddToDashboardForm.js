import { __awaiter, __rest } from "tslib";
import { partial } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { locationUtil } from '@grafana/data';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { Alert, Button, Field, InputControl, Modal, RadioButtonGroup } from '@grafana/ui';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';
import { contextSrv } from 'app/core/services/context_srv';
import { removeDashboardToFetchFromLocalStorage } from 'app/features/dashboard/state/initDashboard';
import { AccessControlAction, useSelector } from 'app/types';
import { getExploreItemSelector } from '../../state/selectors';
import { setDashboardInLocalStorage, AddToDashboardError } from './addToDashboard';
var SaveTarget;
(function (SaveTarget) {
    SaveTarget["NewDashboard"] = "new-dashboard";
    SaveTarget["ExistingDashboard"] = "existing-dashboard";
})(SaveTarget || (SaveTarget = {}));
function assertIsSaveToExistingDashboardError(errors) {
    // the shape of the errors object is always compatible with the type above, but we need to
    // explicitly assert its type so that TS can narrow down FormDTO to SaveToExistingDashboard
    // when we use it in the form.
}
function getDashboardURL(dashboardUid) {
    return dashboardUid ? `d/${dashboardUid}` : 'dashboard/new';
}
var GenericError;
(function (GenericError) {
    GenericError["UNKNOWN"] = "unknown-error";
    GenericError["NAVIGATION"] = "navigation-error";
})(GenericError || (GenericError = {}));
export function AddToDashboardForm(props) {
    const { exploreId, onClose } = props;
    const exploreItem = useSelector(getExploreItemSelector(exploreId));
    const [submissionError, setSubmissionError] = useState();
    const { handleSubmit, control, formState: { errors }, watch, } = useForm({
        defaultValues: { saveTarget: SaveTarget.NewDashboard },
    });
    const canCreateDashboard = contextSrv.hasPermission(AccessControlAction.DashboardsCreate);
    const canWriteDashboard = contextSrv.hasPermission(AccessControlAction.DashboardsWrite);
    const saveTargets = [];
    if (canCreateDashboard) {
        saveTargets.push({
            label: 'New dashboard',
            value: SaveTarget.NewDashboard,
        });
    }
    if (canWriteDashboard) {
        saveTargets.push({
            label: 'Existing dashboard',
            value: SaveTarget.ExistingDashboard,
        });
    }
    const saveTarget = saveTargets.length > 1 ? watch('saveTarget') : saveTargets[0].value;
    const onSubmit = (openInNewTab, data) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        setSubmissionError(undefined);
        const dashboardUid = data.saveTarget === SaveTarget.ExistingDashboard ? data.dashboardUid : undefined;
        reportInteraction('e_2_d_submit', {
            newTab: openInNewTab,
            saveTarget: data.saveTarget,
            queries: exploreItem.queries.length,
        });
        try {
            yield setDashboardInLocalStorage({
                dashboardUid,
                datasource: (_a = exploreItem.datasourceInstance) === null || _a === void 0 ? void 0 : _a.getRef(),
                queries: exploreItem.queries,
                queryResponse: exploreItem.queryResponse,
            });
        }
        catch (error) {
            switch (error) {
                case AddToDashboardError.FETCH_DASHBOARD:
                    setSubmissionError({ error, message: 'Could not fetch dashboard information. Please try again.' });
                    break;
                case AddToDashboardError.SET_DASHBOARD_LS:
                    setSubmissionError({ error, message: 'Could not add panel to dashboard. Please try again.' });
                    break;
                default:
                    setSubmissionError({ error: GenericError.UNKNOWN, message: 'Something went wrong. Please try again.' });
            }
            return;
        }
        const dashboardURL = getDashboardURL(dashboardUid);
        if (!openInNewTab) {
            onClose();
            locationService.push(locationUtil.stripBaseFromUrl(dashboardURL));
            return;
        }
        const didTabOpen = !!global.open(config.appUrl + dashboardURL, '_blank');
        if (!didTabOpen) {
            setSubmissionError({
                error: GenericError.NAVIGATION,
                message: 'Could not navigate to the selected dashboard. Please try again.',
            });
            removeDashboardToFetchFromLocalStorage();
            return;
        }
        onClose();
    });
    useEffect(() => {
        reportInteraction('e_2_d_open');
    }, []);
    return (React.createElement("form", null,
        saveTargets.length > 1 && (React.createElement(InputControl, { control: control, render: (_a) => {
                var _b = _a.field, { ref } = _b, field = __rest(_b, ["ref"]);
                return (React.createElement(Field, { label: "Target dashboard", description: "Choose where to add the panel." },
                    React.createElement(RadioButtonGroup, Object.assign({ options: saveTargets }, field, { id: "e2d-save-target" }))));
            }, name: "saveTarget" })),
        saveTarget === SaveTarget.ExistingDashboard &&
            (() => {
                assertIsSaveToExistingDashboardError(errors);
                return (React.createElement(InputControl, { render: (_a) => {
                        var _b;
                        var _c = _a.field, { ref, value, onChange } = _c, field = __rest(_c, ["ref", "value", "onChange"]);
                        return (React.createElement(Field, { label: "Dashboard", description: "Select in which dashboard the panel will be created.", error: (_b = errors.dashboardUid) === null || _b === void 0 ? void 0 : _b.message, invalid: !!errors.dashboardUid },
                            React.createElement(DashboardPicker, Object.assign({}, field, { inputId: "e2d-dashboard-picker", defaultOptions: true, onChange: (d) => onChange(d === null || d === void 0 ? void 0 : d.uid) }))));
                    }, control: control, name: "dashboardUid", shouldUnregister: true, rules: { required: { value: true, message: 'This field is required.' } } }));
            })(),
        submissionError && (React.createElement(Alert, { severity: "error", title: "Error adding the panel" }, submissionError.message)),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { type: "reset", onClick: onClose, fill: "outline", variant: "secondary" }, "Cancel"),
            React.createElement(Button, { type: "submit", variant: "secondary", onClick: handleSubmit(partial(onSubmit, true)), icon: "external-link-alt" }, "Open in new tab"),
            React.createElement(Button, { type: "submit", variant: "primary", onClick: handleSubmit(partial(onSubmit, false)), icon: "apps" }, "Open dashboard"))));
}
//# sourceMappingURL=AddToDashboardForm.js.map