import { css } from '@emotion/css';
import { defaults, groupBy, isArray, sumBy, uniqueId, upperFirst } from 'lodash';
import pluralize from 'pluralize';
import React, { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useToggle } from 'react-use';
import { Stack } from '@grafana/experimental';
import { Badge, Button, Dropdown, getTagColorsFromName, Icon, Menu, Text, Tooltip, useStyles2 } from '@grafana/ui';
import ConditionalWrap from 'app/features/alerting/components/ConditionalWrap';
import { AlertmanagerAction, useAlertmanagerAbilities } from '../../hooks/useAbilities';
import { INTEGRATION_ICONS } from '../../types/contact-points';
import { normalizeMatchers } from '../../utils/matchers';
import { createContactPointLink, createMuteTimingLink } from '../../utils/misc';
import { getInheritedProperties } from '../../utils/notification-policies';
import { Authorize } from '../Authorize';
import { HoverCard } from '../HoverCard';
import { Label } from '../Label';
import { MetaText } from '../MetaText';
import { ProvisioningBadge } from '../Provisioning';
import { Spacer } from '../Spacer';
import { Strong } from '../Strong';
import { GrafanaPoliciesExporter } from '../export/GrafanaPoliciesExporter';
import { Matchers } from './Matchers';
import { TIMING_OPTIONS_DEFAULTS } from './timingOptions';
const Policy = ({ receivers = [], contactPointsState, readOnly = false, provisioned = false, alertGroups = [], alertManagerSourceName, currentRoute, routeTree, inheritedProperties, routesMatchingFilters = [], matchingInstancesPreview = { enabled: false }, onEditPolicy, onAddPolicy, onDeletePolicy, onShowAlertInstances, }) => {
    var _a, _b, _c, _d, _e;
    const styles = useStyles2(getStyles);
    const isDefaultPolicy = currentRoute === routeTree;
    const [[updatePoliciesSupported, updatePoliciesAllowed], [deletePolicySupported, deletePolicyAllowed], [exportPoliciesSupported, exportPoliciesAllowed],] = useAlertmanagerAbilities([
        AlertmanagerAction.UpdateNotificationPolicyTree,
        AlertmanagerAction.DeleteNotificationPolicy,
        AlertmanagerAction.ExportNotificationPolicies,
    ]);
    const contactPoint = currentRoute.receiver;
    const continueMatching = (_a = currentRoute.continue) !== null && _a !== void 0 ? _a : false;
    const groupBy = currentRoute.group_by;
    const muteTimings = (_b = currentRoute.mute_time_intervals) !== null && _b !== void 0 ? _b : [];
    const timingOptions = {
        group_wait: currentRoute.group_wait,
        group_interval: currentRoute.group_interval,
        repeat_interval: currentRoute.repeat_interval,
    };
    const matchers = normalizeMatchers(currentRoute);
    const hasMatchers = Boolean(matchers && matchers.length);
    const hasMuteTimings = Boolean(muteTimings.length);
    const hasFocus = routesMatchingFilters.some((route) => route.id === currentRoute.id);
    // gather errors here
    const errors = [];
    // if the route has no matchers, is not the default policy (that one has none) and it does not continue
    // then we should warn the user that it's a suspicious setup
    const showMatchesAllLabelsWarning = !hasMatchers && !isDefaultPolicy && !continueMatching;
    // if the receiver / contact point has any errors show it on the policy
    const actualContactPoint = (_c = contactPoint !== null && contactPoint !== void 0 ? contactPoint : inheritedProperties === null || inheritedProperties === void 0 ? void 0 : inheritedProperties.receiver) !== null && _c !== void 0 ? _c : '';
    const contactPointErrors = contactPointsState ? getContactPointErrors(actualContactPoint, contactPointsState) : [];
    contactPointErrors.forEach((error) => {
        errors.push(error);
    });
    const hasInheritedProperties = inheritedProperties && Object.keys(inheritedProperties).length > 0;
    const childPolicies = (_d = currentRoute.routes) !== null && _d !== void 0 ? _d : [];
    const inheritedGrouping = hasInheritedProperties && inheritedProperties.group_by;
    const noGrouping = isArray(groupBy) && groupBy[0] === '...';
    const customGrouping = !noGrouping && isArray(groupBy) && groupBy.length > 0;
    const singleGroup = isDefaultPolicy && isArray(groupBy) && groupBy.length === 0;
    const matchingAlertGroups = (_e = matchingInstancesPreview === null || matchingInstancesPreview === void 0 ? void 0 : matchingInstancesPreview.groupsMap) === null || _e === void 0 ? void 0 : _e.get(currentRoute.id);
    // sum all alert instances for all groups we're handling
    const numberOfAlertInstances = matchingAlertGroups
        ? sumBy(matchingAlertGroups, (group) => group.alerts.length)
        : undefined;
    const [showExportDrawer, toggleShowExportDrawer] = useToggle(false);
    const showExportAction = exportPoliciesAllowed && exportPoliciesSupported && isDefaultPolicy;
    const showEditAction = updatePoliciesSupported && updatePoliciesAllowed;
    const showDeleteAction = deletePolicySupported && deletePolicyAllowed && !isDefaultPolicy;
    // build the menu actions for our policy
    const dropdownMenuActions = [];
    if (showEditAction) {
        dropdownMenuActions.push(React.createElement(Fragment, { key: "edit-policy" },
            React.createElement(ConditionalWrap, { shouldWrap: provisioned, wrap: ProvisionedTooltip },
                React.createElement(Menu.Item, { icon: "edit", disabled: provisioned, label: "Edit", onClick: () => onEditPolicy(currentRoute, isDefaultPolicy) }))));
    }
    if (showExportAction) {
        dropdownMenuActions.push(React.createElement(Menu.Item, { key: "export-policy", icon: "download-alt", label: "Export", onClick: toggleShowExportDrawer }));
    }
    if (showDeleteAction) {
        dropdownMenuActions.push(React.createElement(Fragment, { key: "delete-policy" },
            React.createElement(Menu.Divider, null),
            React.createElement(ConditionalWrap, { shouldWrap: provisioned, wrap: ProvisionedTooltip },
                React.createElement(Menu.Item, { destructive: true, icon: "trash-alt", disabled: provisioned, label: "Delete", onClick: () => onDeletePolicy(currentRoute) }))));
    }
    // TODO dead branch detection, warnings for all sort of configs that won't work or will never be activated
    return (React.createElement(Stack, { direction: "column", gap: 1.5 },
        React.createElement("div", { className: styles.policyWrapper(hasFocus), "data-testid": isDefaultPolicy ? 'am-root-route-container' : 'am-route-container' },
            continueMatching && React.createElement(ContinueMatchingIndicator, null),
            showMatchesAllLabelsWarning && React.createElement(AllMatchesIndicator, null),
            React.createElement("div", { className: styles.policyItemWrapper },
                React.createElement(Stack, { direction: "column", gap: 1 },
                    React.createElement("div", null,
                        React.createElement(Stack, { direction: "row", alignItems: "center", gap: 1 },
                            isDefaultPolicy ? (React.createElement(DefaultPolicyIndicator, null)) : hasMatchers ? (React.createElement(Matchers, { matchers: matchers !== null && matchers !== void 0 ? matchers : [] })) : (React.createElement("span", { className: styles.metadata }, "No matchers")),
                            React.createElement(Spacer, null),
                            errors.length > 0 && React.createElement(Errors, { errors: errors }),
                            provisioned && React.createElement(ProvisioningBadge, null),
                            !readOnly && (React.createElement(Stack, { direction: "row", gap: 0.5 },
                                React.createElement(Authorize, { actions: [AlertmanagerAction.CreateNotificationPolicy] },
                                    React.createElement(ConditionalWrap, { shouldWrap: provisioned, wrap: ProvisionedTooltip },
                                        React.createElement(Button, { variant: "secondary", icon: "plus", size: "sm", onClick: () => onAddPolicy(currentRoute), disabled: provisioned, type: "button" }, "New nested policy"))),
                                dropdownMenuActions.length > 0 && (React.createElement(Dropdown, { overlay: React.createElement(Menu, null, dropdownMenuActions) },
                                    React.createElement(Button, { icon: "ellipsis-h", variant: "secondary", size: "sm", type: "button", "aria-label": "more-actions", "data-testid": "more-actions" }))))))),
                    React.createElement("div", { className: styles.metadataRow },
                        React.createElement(Stack, { direction: "row", alignItems: "center", gap: 1 },
                            matchingInstancesPreview.enabled && (React.createElement(MetaText, { icon: "layers-alt", onClick: () => {
                                    matchingAlertGroups && onShowAlertInstances(matchingAlertGroups, matchers);
                                }, "data-testid": "matching-instances" },
                                React.createElement(Strong, null, numberOfAlertInstances !== null && numberOfAlertInstances !== void 0 ? numberOfAlertInstances : '-'),
                                React.createElement("span", null, pluralize('instance', numberOfAlertInstances)))),
                            contactPoint && (React.createElement(MetaText, { icon: "at", "data-testid": "contact-point" },
                                React.createElement("span", null, "Delivered to"),
                                React.createElement(ContactPointsHoverDetails, { alertManagerSourceName: alertManagerSourceName, receivers: receivers, contactPoint: contactPoint }))),
                            !inheritedGrouping && (React.createElement(React.Fragment, null,
                                customGrouping && (React.createElement(MetaText, { icon: "layer-group", "data-testid": "grouping" },
                                    React.createElement("span", null, "Grouped by"),
                                    React.createElement(Strong, null, groupBy.join(', ')))),
                                singleGroup && (React.createElement(MetaText, { icon: "layer-group" },
                                    React.createElement("span", null, "Single group"))),
                                noGrouping && (React.createElement(MetaText, { icon: "layer-group" },
                                    React.createElement("span", null, "Not grouping"))))),
                            hasMuteTimings && (React.createElement(MetaText, { icon: "calendar-slash", "data-testid": "mute-timings" },
                                React.createElement("span", null, "Muted when"),
                                React.createElement(MuteTimings, { timings: muteTimings, alertManagerSourceName: alertManagerSourceName }))),
                            timingOptions && (
                            // for the default policy we will also merge the default timings, that way a user can observe what the timing options would be
                            React.createElement(TimingOptionsMeta, { timingOptions: isDefaultPolicy ? defaults(timingOptions, TIMING_OPTIONS_DEFAULTS) : timingOptions })),
                            hasInheritedProperties && (React.createElement(React.Fragment, null,
                                React.createElement(MetaText, { icon: "corner-down-right-alt", "data-testid": "inherited-properties" },
                                    React.createElement("span", null, "Inherited"),
                                    React.createElement(InheritedProperties, { properties: inheritedProperties }))))))))),
        React.createElement("div", { className: styles.childPolicies }, childPolicies.map((child) => {
            const childInheritedProperties = getInheritedProperties(currentRoute, child, inheritedProperties);
            return (React.createElement(Policy, { key: uniqueId(), routeTree: routeTree, currentRoute: child, receivers: receivers, contactPointsState: contactPointsState, readOnly: readOnly || provisioned, inheritedProperties: childInheritedProperties, onAddPolicy: onAddPolicy, onEditPolicy: onEditPolicy, onDeletePolicy: onDeletePolicy, onShowAlertInstances: onShowAlertInstances, alertManagerSourceName: alertManagerSourceName, alertGroups: alertGroups, routesMatchingFilters: routesMatchingFilters, matchingInstancesPreview: matchingInstancesPreview }));
        })),
        showExportDrawer && React.createElement(GrafanaPoliciesExporter, { onClose: toggleShowExportDrawer })));
};
const ProvisionedTooltip = (children) => (React.createElement(Tooltip, { content: "Provisioned items cannot be edited in the UI", placement: "top" },
    React.createElement("span", null, children)));
const Errors = ({ errors }) => (React.createElement(HoverCard, { arrow: true, placement: "top", content: React.createElement(Stack, { direction: "column", gap: 0.5 }, errors.map((error) => (React.createElement(Fragment, { key: uniqueId() }, error)))) },
    React.createElement("span", null,
        React.createElement(Badge, { icon: "exclamation-circle", color: "red", text: pluralize('error', errors.length, true) }))));
const ContinueMatchingIndicator = () => {
    const styles = useStyles2(getStyles);
    return (React.createElement(Tooltip, { placement: "top", content: "This route will continue matching other policies" },
        React.createElement("div", { className: styles.gutterIcon, "data-testid": "continue-matching" },
            React.createElement(Icon, { name: "arrow-down" }))));
};
const AllMatchesIndicator = () => {
    const styles = useStyles2(getStyles);
    return (React.createElement(Tooltip, { placement: "top", content: "This policy matches all labels" },
        React.createElement("div", { className: styles.gutterIcon, "data-testid": "matches-all" },
            React.createElement(Icon, { name: "exclamation-triangle" }))));
};
const DefaultPolicyIndicator = () => {
    const styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("strong", null, "Default policy"),
        React.createElement("span", { className: styles.metadata }, "All alert instances will be handled by the default policy if no other matching policies are found.")));
};
const InheritedProperties = ({ properties }) => (React.createElement(HoverCard, { arrow: true, placement: "top", content: React.createElement(Stack, { direction: "row", gap: 0.5 }, Object.entries(properties).map(([key, value]) => (React.createElement(Label, { key: key, label: routePropertyToLabel(key), value: React.createElement(Strong, null, routePropertyToValue(key, value)) })))) },
    React.createElement("div", null,
        React.createElement(Strong, null, pluralize('property', Object.keys(properties).length, true)))));
const MuteTimings = ({ timings, alertManagerSourceName, }) => {
    /* TODO make a better mute timing overview, allow combining multiple in to one overview */
    /*
      <HoverCard
        arrow
        placement="top"
        header={<MetaText icon="calendar-slash">Mute Timings</MetaText>}
        content={
          // TODO show a combined view of all mute timings here, combining the weekdays, years, months, etc
          <Stack direction="row" gap={0.5}>
            <Label label="Weekdays" value="Saturday and Sunday" />
          </Stack>
        }
      >
        <div>
          <Strong>{muteTimings.join(', ')}</Strong>
        </div>
      </HoverCard>
    */
    return (React.createElement("div", null,
        React.createElement(Strong, null, timings.map((timing) => (React.createElement(Link, { key: timing, to: createMuteTimingLink(timing, alertManagerSourceName) }, timing))))));
};
const TimingOptionsMeta = ({ timingOptions }) => {
    const groupWait = timingOptions.group_wait;
    const groupInterval = timingOptions.group_interval;
    // we don't have any timing options to show – we're inheriting everything from the parent
    // and those show up in a separate "inherited properties" component
    if (!groupWait && !groupInterval) {
        return null;
    }
    return (React.createElement(MetaText, { icon: "hourglass", "data-testid": "timing-options" },
        React.createElement("span", null, "Wait"),
        groupWait && (React.createElement(Tooltip, { placement: "top", content: "How long to initially wait to send a notification for a group of alert instances." },
            React.createElement("span", null,
                React.createElement(Strong, null, groupWait),
                " ",
                React.createElement("span", null, "to group instances"),
                groupWait && groupInterval && ','))),
        groupInterval && (React.createElement(Tooltip, { placement: "top", content: "How long to wait before sending a notification about new alerts that are added to a group of alerts for which an initial notification has already been sent." },
            React.createElement("span", null,
                React.createElement(Strong, null, groupInterval),
                " ",
                React.createElement("span", null, "before sending updates"))))));
};
// @TODO make this work for cloud AMs too
const ContactPointsHoverDetails = ({ alertManagerSourceName, contactPoint, receivers, }) => {
    const details = receivers.find((receiver) => receiver.name === contactPoint);
    if (!details) {
        return (React.createElement(Link, { to: createContactPointLink(contactPoint, alertManagerSourceName) },
            React.createElement(Strong, null, contactPoint)));
    }
    const integrations = details.grafana_managed_receiver_configs;
    if (!integrations) {
        return (React.createElement(Link, { to: createContactPointLink(contactPoint, alertManagerSourceName) },
            React.createElement(Strong, null, contactPoint)));
    }
    const groupedIntegrations = groupBy(details.grafana_managed_receiver_configs, (config) => config.type);
    return (React.createElement(HoverCard, { arrow: true, placement: "top", header: React.createElement(MetaText, { icon: "at" },
            React.createElement("div", null, "Contact Point"),
            React.createElement(Strong, null, contactPoint)), key: uniqueId(), content: React.createElement(Stack, { direction: "row", gap: 0.5 }, Object.entries(groupedIntegrations).map(([type, integrations]) => (React.createElement(Label, { key: uniqueId(), label: integrations.length > 1 ? integrations.length : undefined, icon: INTEGRATION_ICONS[type], value: upperFirst(type) })))) },
        React.createElement(Link, { to: createContactPointLink(contactPoint, alertManagerSourceName) },
            React.createElement(Strong, null, contactPoint))));
};
function getContactPointErrors(contactPoint, contactPointsState) {
    var _a, _b;
    const notifierStates = Object.entries((_b = (_a = contactPointsState[contactPoint]) === null || _a === void 0 ? void 0 : _a.notifiers) !== null && _b !== void 0 ? _b : []);
    const contactPointErrors = notifierStates.reduce((acc = [], [_, notifierStatuses]) => {
        const notifierErrors = notifierStatuses
            .filter((status) => status.lastNotifyAttemptError)
            .map((status) => (React.createElement(Label, { icon: "at", key: uniqueId(), label: `Contact Point › ${status.name}`, value: status.lastNotifyAttemptError })));
        return acc.concat(notifierErrors);
    }, []);
    return contactPointErrors;
}
const routePropertyToLabel = (key) => {
    switch (key) {
        case 'receiver':
            return 'Contact Point';
        case 'group_by':
            return 'Group by';
        case 'group_interval':
            return 'Group interval';
        case 'group_wait':
            return 'Group wait';
        case 'mute_time_intervals':
            return 'Mute timings';
        case 'repeat_interval':
            return 'Repeat interval';
        default:
            return key;
    }
};
const routePropertyToValue = (key, value) => {
    const isNotGrouping = key === 'group_by' && Array.isArray(value) && value[0] === '...';
    const isSingleGroup = key === 'group_by' && Array.isArray(value) && value.length === 0;
    if (isNotGrouping) {
        return (React.createElement(Text, { variant: "bodySmall", color: "secondary" }, "Not grouping"));
    }
    if (isSingleGroup) {
        return (React.createElement(Text, { variant: "bodySmall", color: "secondary" }, "Single group"));
    }
    return Array.isArray(value) ? value.join(', ') : value;
};
const getStyles = (theme) => ({
    matcher: (label) => {
        const { color, borderColor } = getTagColorsFromName(label);
        return {
            wrapper: css `
        color: #fff;
        background: ${color};
        padding: ${theme.spacing(0.33)} ${theme.spacing(0.66)};
        font-size: ${theme.typography.bodySmall.fontSize};

        border: solid 1px ${borderColor};
        border-radius: ${theme.shape.radius.default};
      `,
        };
    },
    childPolicies: css `
    margin-left: ${theme.spacing(4)};
    position: relative;

    &:before {
      content: '';
      position: absolute;
      height: calc(100% - 10px);

      border-left: solid 1px ${theme.colors.border.weak};

      margin-top: 0;
      margin-left: -20px;
    }
  `,
    policyItemWrapper: css `
    padding: ${theme.spacing(1.5)};
  `,
    metadataRow: css `
    background: ${theme.colors.background.secondary};

    border-bottom-left-radius: ${theme.shape.borderRadius(2)};
    border-bottom-right-radius: ${theme.shape.borderRadius(2)};
  `,
    policyWrapper: (hasFocus = false) => css `
    flex: 1;
    position: relative;
    background: ${theme.colors.background.secondary};

    border-radius: ${theme.shape.radius.default};
    border: solid 1px ${theme.colors.border.weak};

    ${hasFocus &&
        css `
      border-color: ${theme.colors.primary.border};
    `}
  `,
    metadata: css `
    color: ${theme.colors.text.secondary};

    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.bodySmall.fontWeight};
  `,
    break: css `
    width: 100%;
    height: 0;
    margin-bottom: ${theme.spacing(2)};
  `,
    gutterIcon: css `
    position: absolute;

    top: 0;
    transform: translateY(50%);
    left: -${theme.spacing(4)};

    color: ${theme.colors.text.secondary};
    background: ${theme.colors.background.primary};

    width: 25px;
    height: 25px;
    text-align: center;

    border: solid 1px ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};

    padding: 0;
  `,
});
export { Policy };
//# sourceMappingURL=Policy.js.map