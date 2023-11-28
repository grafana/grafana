import { css } from '@emotion/css';
import { groupBy, size, uniqueId, upperFirst } from 'lodash';
import pluralize from 'pluralize';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { dateTime } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Alert, Button, Dropdown, Icon, LoadingPlaceholder, Menu, Tooltip, useStyles2, Text, LinkButton, TabsBar, TabContent, Tab, Pagination, } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import ConditionalWrap from 'app/features/alerting/components/ConditionalWrap';
import { isOrgAdmin } from 'app/features/plugins/admin/permissions';
import { receiverTypeNames } from 'app/plugins/datasource/alertmanager/consts';
import { usePagination } from '../../hooks/usePagination';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { INTEGRATION_ICONS } from '../../types/contact-points';
import { getNotificationsPermissions } from '../../utils/access-control';
import { GRAFANA_RULES_SOURCE_NAME, isVanillaPrometheusAlertManagerDataSource } from '../../utils/datasource';
import { createUrl } from '../../utils/url';
import { MetaText } from '../MetaText';
import { ProvisioningBadge } from '../Provisioning';
import { Spacer } from '../Spacer';
import { Strong } from '../Strong';
import { GlobalConfigAlert } from '../receivers/ReceiversAndTemplatesView';
import { UnusedContactPointBadge } from '../receivers/ReceiversTable';
import { MessageTemplates } from './MessageTemplates';
import { useDeleteContactPointModal } from './Modals';
import { RECEIVER_STATUS_KEY, useContactPointsWithStatus, useDeleteContactPoint } from './useContactPoints';
import { getReceiverDescription, isProvisioned } from './utils';
var ActiveTab;
(function (ActiveTab) {
    ActiveTab[ActiveTab["ContactPoints"] = 0] = "ContactPoints";
    ActiveTab[ActiveTab["MessageTemplates"] = 1] = "MessageTemplates";
})(ActiveTab || (ActiveTab = {}));
const DEFAULT_PAGE_SIZE = 25;
const ContactPoints = () => {
    const { selectedAlertmanager } = useAlertmanager();
    // TODO hook up to query params
    const [activeTab, setActiveTab] = useState(ActiveTab.ContactPoints);
    let { isLoading, error, contactPoints } = useContactPointsWithStatus(selectedAlertmanager);
    const { deleteTrigger, updateAlertmanagerState } = useDeleteContactPoint(selectedAlertmanager);
    const [DeleteModal, showDeleteModal] = useDeleteContactPointModal(deleteTrigger, updateAlertmanagerState.isLoading);
    const showingContactPoints = activeTab === ActiveTab.ContactPoints;
    const showingMessageTemplates = activeTab === ActiveTab.MessageTemplates;
    if (error) {
        // TODO fix this type casting, when error comes from "getContactPointsStatus" it probably won't be a SerializedError
        return React.createElement(Alert, { title: "Failed to fetch contact points" }, error.message);
    }
    const isGrafanaManagedAlertmanager = selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME;
    const isVanillaAlertmanager = isVanillaPrometheusAlertManagerDataSource(selectedAlertmanager);
    const permissions = getNotificationsPermissions(selectedAlertmanager);
    const allowedToAddContactPoint = contextSrv.hasPermission(permissions.create);
    return (React.createElement(React.Fragment, null,
        React.createElement(Stack, { direction: "column" },
            React.createElement(TabsBar, null,
                React.createElement(Tab, { label: "Contact Points", active: showingContactPoints, counter: contactPoints.length, onChangeTab: () => setActiveTab(ActiveTab.ContactPoints) }),
                React.createElement(Tab, { label: "Message Templates", active: showingMessageTemplates, onChangeTab: () => setActiveTab(ActiveTab.MessageTemplates) }),
                React.createElement(Spacer, null),
                showingContactPoints && (React.createElement(LinkButton, { icon: "plus", variant: "primary", href: "/alerting/notifications/receivers/new", 
                    // TODO clarify why the button has been disabled
                    disabled: !allowedToAddContactPoint || isVanillaAlertmanager }, "Add contact point")),
                showingMessageTemplates && (React.createElement(LinkButton, { icon: "plus", variant: "primary", href: "/alerting/notifications/templates/new" }, "Add message template"))),
            React.createElement(TabContent, null,
                React.createElement(Stack, { direction: "column" },
                    React.createElement(React.Fragment, null,
                        isLoading && React.createElement(LoadingPlaceholder, { text: 'Loading...' }),
                        showingContactPoints && (React.createElement(React.Fragment, null, error ? (React.createElement(Alert, { title: "Failed to fetch contact points" }, String(error))) : (React.createElement(React.Fragment, null,
                            React.createElement(Text, { variant: "body", color: "secondary" }, "Define where notifications are sent, a contact point can contain multiple integrations."),
                            React.createElement(ContactPointsList, { contactPoints: contactPoints, pageSize: DEFAULT_PAGE_SIZE, onDelete: (name) => showDeleteModal(name), disabled: updateAlertmanagerState.isLoading }),
                            !isGrafanaManagedAlertmanager && React.createElement(GlobalConfigAlert, { alertManagerName: selectedAlertmanager }))))),
                        showingMessageTemplates && (React.createElement(React.Fragment, null,
                            React.createElement(Text, { variant: "body", color: "secondary" }, "Create message templates to customize your notifications."),
                            React.createElement(MessageTemplates, null))))))),
        DeleteModal));
};
const ContactPointsList = ({ contactPoints, disabled = false, pageSize = DEFAULT_PAGE_SIZE, onDelete, }) => {
    const { page, pageItems, numberOfPages, onPageChange } = usePagination(contactPoints, 1, pageSize);
    return (React.createElement(React.Fragment, null,
        pageItems.map((contactPoint, index) => {
            const provisioned = isProvisioned(contactPoint);
            const policies = contactPoint.numberOfPolicies;
            return (React.createElement(ContactPoint, { key: `${contactPoint.name}-${index}`, name: contactPoint.name, disabled: disabled, onDelete: onDelete, receivers: contactPoint.grafana_managed_receiver_configs, provisioned: provisioned, policies: policies }));
        }),
        React.createElement(Pagination, { currentPage: page, numberOfPages: numberOfPages, onNavigate: onPageChange, hideWhenSinglePage: true })));
};
export const ContactPoint = ({ name, disabled = false, provisioned = false, receivers, policies = 0, onDelete, }) => {
    const styles = useStyles2(getStyles);
    // TODO probably not the best way to figure out if we want to show either only the summary or full metadata for the receivers?
    const showFullMetadata = receivers.some((receiver) => Boolean(receiver[RECEIVER_STATUS_KEY]));
    return (React.createElement("div", { className: styles.contactPointWrapper, "data-testid": "contact-point" },
        React.createElement(Stack, { direction: "column", gap: 0 },
            React.createElement(ContactPointHeader, { name: name, policies: policies, provisioned: provisioned, disabled: disabled, onDelete: onDelete }),
            showFullMetadata ? (React.createElement("div", null, receivers === null || receivers === void 0 ? void 0 : receivers.map((receiver) => {
                const diagnostics = receiver[RECEIVER_STATUS_KEY];
                const sendingResolved = !Boolean(receiver.disableResolveMessage);
                return (React.createElement(ContactPointReceiver, { key: uniqueId(), type: receiver.type, description: getReceiverDescription(receiver), diagnostics: diagnostics, sendingResolved: sendingResolved }));
            }))) : (React.createElement("div", null,
                React.createElement(ContactPointReceiverSummary, { receivers: receivers }))))));
};
const ContactPointHeader = (props) => {
    const { name, disabled = false, provisioned = false, policies = 0, onDelete } = props;
    const styles = useStyles2(getStyles);
    const { selectedAlertmanager } = useAlertmanager();
    const permissions = getNotificationsPermissions(selectedAlertmanager !== null && selectedAlertmanager !== void 0 ? selectedAlertmanager : '');
    const isReferencedByPolicies = policies > 0;
    const isGranaManagedAlertmanager = selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME;
    // we make a distinction here becase for "canExport" we show the menu item, if not we hide it
    const canExport = isGranaManagedAlertmanager;
    const allowedToExport = contextSrv.hasPermission(permissions.provisioning.read);
    return (React.createElement("div", { className: styles.headerWrapper },
        React.createElement(Stack, { direction: "row", alignItems: "center", gap: 1 },
            React.createElement(Stack, { alignItems: "center", gap: 1 },
                React.createElement(Text, { variant: "body", weight: "medium" }, name)),
            isReferencedByPolicies ? (React.createElement(MetaText, null,
                React.createElement(Link, { to: createUrl('/alerting/routes', { contactPoint: name }) },
                    "is used by ",
                    React.createElement(Strong, null, policies),
                    " ",
                    pluralize('notification policy', policies)))) : (React.createElement(UnusedContactPointBadge, null)),
            provisioned && React.createElement(ProvisioningBadge, null),
            React.createElement(Spacer, null),
            React.createElement(LinkButton, { tooltipPlacement: "top", tooltip: provisioned ? 'Provisioned contact points cannot be edited in the UI' : undefined, variant: "secondary", size: "sm", icon: provisioned ? 'document-info' : 'edit', type: "button", disabled: disabled, "aria-label": `${provisioned ? 'view' : 'edit'}-action`, "data-testid": `${provisioned ? 'view' : 'edit'}-action`, href: `/alerting/notifications/receivers/${encodeURIComponent(name)}/edit` }, provisioned ? 'View' : 'Edit'),
            React.createElement(Dropdown, { overlay: React.createElement(Menu, null,
                    canExport && (React.createElement(React.Fragment, null,
                        React.createElement(Menu.Item, { icon: "download-alt", label: isOrgAdmin() ? 'Export' : 'Export redacted', disabled: !allowedToExport, url: createUrl(`/api/v1/provisioning/contact-points/export/`, {
                                download: 'true',
                                format: 'yaml',
                                decrypt: isOrgAdmin().toString(),
                                name: name,
                            }), target: "_blank", "data-testid": "export" }),
                        React.createElement(Menu.Divider, null))),
                    React.createElement(ConditionalWrap, { shouldWrap: policies > 0, wrap: (children) => (React.createElement(Tooltip, { content: 'Contact point is currently in use by one or more notification policies', placement: "top" },
                            React.createElement("span", null, children))) },
                        React.createElement(Menu.Item, { label: "Delete", icon: "trash-alt", destructive: true, disabled: disabled || provisioned || policies > 0, onClick: () => onDelete(name) }))) },
                React.createElement(Button, { variant: "secondary", size: "sm", icon: "ellipsis-h", type: "button", "aria-label": "more-actions", "data-testid": "more-actions" })))));
};
const ContactPointReceiver = (props) => {
    var _a;
    const { type, description, diagnostics, sendingResolved = true } = props;
    const styles = useStyles2(getStyles);
    const iconName = INTEGRATION_ICONS[type];
    const hasMetadata = diagnostics !== undefined;
    // TODO get the actual name of the type from /ngalert if grafanaManaged AM
    const receiverName = (_a = receiverTypeNames[type]) !== null && _a !== void 0 ? _a : upperFirst(type);
    return (React.createElement("div", { className: styles.integrationWrapper },
        React.createElement(Stack, { direction: "column", gap: 0.5 },
            React.createElement(Stack, { direction: "row", alignItems: "center", gap: 1 },
                React.createElement(Stack, { direction: "row", alignItems: "center", gap: 0.5 },
                    iconName && React.createElement(Icon, { name: iconName }),
                    React.createElement(Text, { variant: "body", color: "primary" }, receiverName)),
                description && (React.createElement(Text, { variant: "bodySmall", color: "secondary" }, description))),
            hasMetadata && React.createElement(ContactPointReceiverMetadataRow, { diagnostics: diagnostics, sendingResolved: sendingResolved }))));
};
/**
 * This summary is used when we're dealing with non-Grafana managed alertmanager since they
 * don't have any metadata worth showing other than a summary of what types are configured for the contact point
 */
const ContactPointReceiverSummary = ({ receivers }) => {
    const styles = useStyles2(getStyles);
    const countByType = groupBy(receivers, (receiver) => receiver.type);
    return (React.createElement("div", { className: styles.integrationWrapper },
        React.createElement(Stack, { direction: "column", gap: 0 },
            React.createElement(Stack, { direction: "row", alignItems: "center", gap: 1 }, Object.entries(countByType).map(([type, receivers], index) => {
                var _a;
                const iconName = INTEGRATION_ICONS[type];
                const receiverName = (_a = receiverTypeNames[type]) !== null && _a !== void 0 ? _a : upperFirst(type);
                const isLastItem = size(countByType) - 1 === index;
                return (React.createElement(React.Fragment, { key: type },
                    React.createElement(Stack, { direction: "row", alignItems: "center", gap: 0.5 },
                        iconName && React.createElement(Icon, { name: iconName }),
                        React.createElement(Text, { variant: "body", color: "primary" },
                            receiverName,
                            receivers.length > 1 && React.createElement(React.Fragment, null,
                                " (",
                                receivers.length,
                                ")"))),
                    !isLastItem && '⋅'));
            })))));
};
const ContactPointReceiverMetadataRow = ({ diagnostics, sendingResolved }) => {
    const styles = useStyles2(getStyles);
    const failedToSend = Boolean(diagnostics.lastNotifyAttemptError);
    const lastDeliveryAttempt = dateTime(diagnostics.lastNotifyAttempt);
    const lastDeliveryAttemptDuration = diagnostics.lastNotifyAttemptDuration;
    const hasDeliveryAttempt = lastDeliveryAttempt.isValid();
    return (React.createElement("div", { className: styles.metadataRow },
        React.createElement(Stack, { direction: "row", gap: 1 }, failedToSend ? (React.createElement(React.Fragment, null,
            React.createElement(MetaText, { color: "error", icon: "exclamation-circle" },
                React.createElement(Tooltip, { content: diagnostics.lastNotifyAttemptError },
                    React.createElement("span", null, "Last delivery attempt failed"))))) : (React.createElement(React.Fragment, null,
            hasDeliveryAttempt && (React.createElement(React.Fragment, null,
                React.createElement(MetaText, { icon: "clock-nine" },
                    "Last delivery attempt",
                    ' ',
                    React.createElement(Tooltip, { content: lastDeliveryAttempt.toLocaleString() },
                        React.createElement("span", null,
                            React.createElement(Strong, null, lastDeliveryAttempt.locale('en').fromNow())))),
                React.createElement(MetaText, { icon: "stopwatch" },
                    "took ",
                    React.createElement(Strong, null, lastDeliveryAttemptDuration)))),
            !hasDeliveryAttempt && React.createElement(MetaText, { icon: "clock-nine" }, "No delivery attempts"),
            !sendingResolved && (React.createElement(MetaText, { icon: "info-circle" },
                "Delivering ",
                React.createElement(Strong, null, "only firing"),
                " notifications")))))));
};
const getStyles = (theme) => ({
    contactPointWrapper: css({
        borderRadius: `${theme.shape.radius.default}`,
        border: `solid 1px ${theme.colors.border.weak}`,
        borderBottom: 'none',
    }),
    integrationWrapper: css({
        position: 'relative',
        background: `${theme.colors.background.primary}`,
        padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
        borderBottom: `solid 1px ${theme.colors.border.weak}`,
    }),
    headerWrapper: css({
        background: `${theme.colors.background.secondary}`,
        padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
        borderBottom: `solid 1px ${theme.colors.border.weak}`,
        borderTopLeftRadius: `${theme.shape.radius.default}`,
        borderTopRightRadius: `${theme.shape.radius.default}`,
    }),
    metadataRow: css({
        borderBottomLeftRadius: `${theme.shape.radius.default}`,
        borderBottomRightRadius: `${theme.shape.radius.default}`,
    }),
});
export default ContactPoints;
//# sourceMappingURL=ContactPoints.v2.js.map