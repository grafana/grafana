import { __awaiter, __rest } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useWindowSize } from 'react-use';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { FieldSet } from '@grafana/ui';
import { Button, ButtonGroup, Field, Input, InputControl, RadioButtonGroup, Spinner, useStyles2, } from '@grafana/ui/src';
import { contextSrv } from 'app/core/services/context_srv';
import { useAddRecipientMutation, useDeleteRecipientMutation, useGetPublicDashboardQuery, useReshareAccessToRecipientMutation, useUpdatePublicDashboardMutation, } from 'app/features/dashboard/api/publicDashboardApi';
import { AccessControlAction, useSelector } from 'app/types';
import { trackDashboardSharingActionPerType } from '../../analytics';
import { shareDashboardType } from '../../utils';
import { PublicDashboardShareType, validEmailRegex } from '../SharePublicDashboardUtils';
const options = [
    { label: 'Anyone with a link', value: PublicDashboardShareType.PUBLIC },
    { label: 'Only specified people', value: PublicDashboardShareType.EMAIL },
];
const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard.EmailSharingConfiguration;
const EmailList = ({ recipients, dashboardUid, publicDashboardUid, }) => {
    const styles = useStyles2(getStyles);
    const [deleteEmail, { isLoading: isDeleteLoading }] = useDeleteRecipientMutation();
    const [reshareAccess, { isLoading: isReshareLoading }] = useReshareAccessToRecipientMutation();
    const isLoading = isDeleteLoading || isReshareLoading;
    const onDeleteEmail = (recipientUid) => {
        trackDashboardSharingActionPerType('delete_email', shareDashboardType.publicDashboard);
        deleteEmail({ recipientUid, dashboardUid: dashboardUid, uid: publicDashboardUid });
    };
    const onReshare = (recipientUid) => {
        trackDashboardSharingActionPerType('reshare_email', shareDashboardType.publicDashboard);
        reshareAccess({ recipientUid, uid: publicDashboardUid });
    };
    return (React.createElement("table", { className: styles.table, "data-testid": selectors.EmailSharingList },
        React.createElement("tbody", null, recipients.map((recipient, idx) => (React.createElement("tr", { key: recipient.uid },
            React.createElement("td", null, recipient.recipient),
            React.createElement("td", null,
                React.createElement(ButtonGroup, { className: styles.tableButtonsContainer },
                    React.createElement(Button, { type: "button", variant: "destructive", fill: "text", "aria-label": "Revoke", title: "Revoke", size: "sm", disabled: isLoading, onClick: () => onDeleteEmail(recipient.uid), "data-testid": `${selectors.DeleteEmail}-${idx}` }, "Revoke"),
                    React.createElement(Button, { type: "button", variant: "primary", fill: "text", "aria-label": "Resend", title: "Resend", size: "sm", disabled: isLoading, onClick: () => onReshare(recipient.uid), "data-testid": `${selectors.ReshareLink}-${idx}` }, "Resend")))))))));
};
export const EmailSharingConfiguration = () => {
    var _a, _b, _c;
    const { width } = useWindowSize();
    const styles = useStyles2(getStyles);
    const dashboardState = useSelector((store) => store.dashboard);
    const dashboard = dashboardState.getModel();
    const { data: publicDashboard } = useGetPublicDashboardQuery(dashboard.uid);
    const [updateShareType] = useUpdatePublicDashboardMutation();
    const [addEmail, { isLoading: isAddEmailLoading }] = useAddRecipientMutation();
    const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);
    const { register, setValue, control, watch, handleSubmit, formState: { errors }, reset, } = useForm({
        defaultValues: {
            shareType: (publicDashboard === null || publicDashboard === void 0 ? void 0 : publicDashboard.share) || PublicDashboardShareType.PUBLIC,
            email: '',
        },
        mode: 'onSubmit',
    });
    const onUpdateShareType = (shareType) => {
        const req = {
            dashboard,
            payload: Object.assign(Object.assign({}, publicDashboard), { share: shareType }),
        };
        updateShareType(req);
    };
    const onSubmit = (data) => __awaiter(void 0, void 0, void 0, function* () {
        //TODO: add if it's domain or not when developed.
        trackDashboardSharingActionPerType('invite_email', shareDashboardType.publicDashboard);
        yield addEmail({ recipient: data.email, uid: publicDashboard.uid, dashboardUid: dashboard.uid }).unwrap();
        reset({ email: '', shareType: PublicDashboardShareType.EMAIL });
    });
    return (React.createElement("form", { onSubmit: handleSubmit(onSubmit) },
        React.createElement(FieldSet, { disabled: !hasWritePermissions, "data-testid": selectors.Container, className: styles.container },
            React.createElement(Field, { label: "Can view dashboard", className: styles.field },
                React.createElement(InputControl, { name: "shareType", control: control, render: ({ field }) => {
                        const { ref } = field, rest = __rest(field, ["ref"]);
                        return (React.createElement(RadioButtonGroup, Object.assign({}, rest, { size: width < 480 ? 'sm' : 'md', options: options, onChange: (shareType) => {
                                trackDashboardSharingActionPerType(`share_type_${shareType === PublicDashboardShareType.EMAIL ? 'email' : 'public'}`, shareDashboardType.publicDashboard);
                                setValue('shareType', shareType);
                                onUpdateShareType(shareType);
                            } })));
                    } })),
            watch('shareType') === PublicDashboardShareType.EMAIL && (React.createElement(React.Fragment, null,
                React.createElement(Field, { label: "Invite", description: "Invite people by email", error: (_a = errors.email) === null || _a === void 0 ? void 0 : _a.message, invalid: !!((_b = errors.email) === null || _b === void 0 ? void 0 : _b.message) || undefined, className: styles.field },
                    React.createElement("div", { className: styles.emailContainer },
                        React.createElement(Input, Object.assign({ className: styles.emailInput, placeholder: "email", autoCapitalize: "none" }, register('email', {
                            required: 'Email is required',
                            pattern: { value: validEmailRegex, message: 'Invalid email' },
                        }), { "data-testid": selectors.EmailSharingInput })),
                        React.createElement(Button, { type: "submit", variant: "primary", disabled: isAddEmailLoading, "data-testid": selectors.EmailSharingInviteButton },
                            "Invite ",
                            isAddEmailLoading && React.createElement(Spinner, null)))),
                !!((_c = publicDashboard === null || publicDashboard === void 0 ? void 0 : publicDashboard.recipients) === null || _c === void 0 ? void 0 : _c.length) && (React.createElement(EmailList, { recipients: publicDashboard.recipients, dashboardUid: dashboard.uid, publicDashboardUid: publicDashboard.uid })))))));
};
const getStyles = (theme) => ({
    container: css `
    label: emailConfigContainer;
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
    gap: ${theme.spacing(3)};
  `,
    field: css `
    label: field-noMargin;
    margin-bottom: 0;
  `,
    emailContainer: css `
    label: emailContainer;
    display: flex;
    gap: ${theme.spacing(1)};
  `,
    emailInput: css `
    label: emailInput;
    flex-grow: 1;
  `,
    table: css `
    label: table;
    display: flex;
    max-height: 220px;
    overflow-y: scroll;

    & tbody {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
    }

    & tr {
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: ${theme.spacing(0.5, 1)};

      :nth-child(odd) {
        background: ${theme.colors.background.secondary};
      }
    }
  `,
    tableButtonsContainer: css `
    display: flex;
    justify-content: end;
  `,
});
//# sourceMappingURL=EmailSharingConfiguration.js.map