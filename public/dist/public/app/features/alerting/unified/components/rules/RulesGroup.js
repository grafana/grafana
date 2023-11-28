import { css } from '@emotion/css';
import pluralize from 'pluralize';
import React, { useEffect, useState } from 'react';
import { Stack } from '@grafana/experimental';
import { logInfo } from '@grafana/runtime';
import { Badge, ConfirmModal, HorizontalGroup, Icon, Spinner, Tooltip, useStyles2 } from '@grafana/ui';
import { useDispatch } from 'app/types';
import { LogMessages } from '../../Analytics';
import { useFolder } from '../../hooks/useFolder';
import { useHasRuler } from '../../hooks/useHasRuler';
import { deleteRulesGroupAction } from '../../state/actions';
import { useRulesAccess } from '../../utils/accessControlHooks';
import { GRAFANA_RULES_SOURCE_NAME, isCloudRulesSource } from '../../utils/datasource';
import { makeFolderLink, makeFolderSettingsLink } from '../../utils/misc';
import { isFederatedRuleGroup, isGrafanaRulerRule } from '../../utils/rules';
import { CollapseToggle } from '../CollapseToggle';
import { RuleLocation } from '../RuleLocation';
import { GrafanaRuleFolderExporter } from '../export/GrafanaRuleFolderExporter';
import { GrafanaRuleGroupExporter } from '../export/GrafanaRuleGroupExporter';
import { ActionIcon } from './ActionIcon';
import { EditCloudGroupModal } from './EditRuleGroupModal';
import { ReorderCloudGroupModal } from './ReorderRuleGroupModal';
import { RuleGroupStats } from './RuleStats';
import { RulesTable } from './RulesTable';
export const RulesGroup = React.memo(({ group, namespace, expandAll, viewMode }) => {
    var _a;
    const { rulesSource } = namespace;
    const dispatch = useDispatch();
    const styles = useStyles2(getStyles);
    const [isEditingGroup, setIsEditingGroup] = useState(false);
    const [isDeletingGroup, setIsDeletingGroup] = useState(false);
    const [isReorderingGroup, setIsReorderingGroup] = useState(false);
    const [isExporting, setIsExporting] = useState(undefined);
    const [isCollapsed, setIsCollapsed] = useState(!expandAll);
    const { canEditRules } = useRulesAccess();
    useEffect(() => {
        setIsCollapsed(!expandAll);
    }, [expandAll]);
    const { hasRuler, rulerRulesLoaded } = useHasRuler();
    const rulerRule = (_a = group.rules[0]) === null || _a === void 0 ? void 0 : _a.rulerRule;
    const folderUID = (rulerRule && isGrafanaRulerRule(rulerRule) && rulerRule.grafana_alert.namespace_uid) || undefined;
    const { folder } = useFolder(folderUID);
    // group "is deleting" if rules source has ruler, but this group has no rules that are in ruler
    const isDeleting = hasRuler(rulesSource) && rulerRulesLoaded(rulesSource) && !group.rules.find((rule) => !!rule.rulerRule);
    const isFederated = isFederatedRuleGroup(group);
    // check if group has provisioned items
    const isProvisioned = group.rules.some((rule) => {
        return isGrafanaRulerRule(rule.rulerRule) && rule.rulerRule.grafana_alert.provenance;
    });
    // check what view mode we are in
    const isListView = viewMode === 'list';
    const isGroupView = viewMode === 'grouped';
    const deleteGroup = () => {
        dispatch(deleteRulesGroupAction(namespace, group));
        setIsDeletingGroup(false);
    };
    const actionIcons = [];
    // for grafana, link to folder views
    if (isDeleting) {
        actionIcons.push(React.createElement(HorizontalGroup, { key: "is-deleting" },
            React.createElement(Spinner, null),
            "deleting"));
    }
    else if (rulesSource === GRAFANA_RULES_SOURCE_NAME) {
        if (folderUID) {
            const baseUrl = makeFolderLink(folderUID);
            if (folder === null || folder === void 0 ? void 0 : folder.canSave) {
                if (isGroupView && !isProvisioned) {
                    actionIcons.push(React.createElement(ActionIcon, { "aria-label": "edit rule group", "data-testid": "edit-group", key: "edit", icon: "pen", tooltip: "edit rule group", onClick: () => setIsEditingGroup(true) }));
                    actionIcons.push(React.createElement(ActionIcon, { "aria-label": "re-order rules", "data-testid": "reorder-group", key: "reorder", icon: "exchange-alt", tooltip: "reorder rules", className: styles.rotate90, onClick: () => setIsReorderingGroup(true) }));
                }
                if (isListView) {
                    actionIcons.push(React.createElement(ActionIcon, { "aria-label": "go to folder", key: "goto", icon: "folder-open", tooltip: "go to folder", to: baseUrl, target: "__blank" }));
                    if (folder === null || folder === void 0 ? void 0 : folder.canAdmin) {
                        actionIcons.push(React.createElement(ActionIcon, { "aria-label": "manage permissions", key: "manage-perms", icon: "lock", tooltip: "manage permissions", to: baseUrl + '/permissions', target: "__blank" }));
                    }
                }
            }
            if (folder) {
                if (isListView) {
                    actionIcons.push(React.createElement(ActionIcon, { "aria-label": "export rule folder", "data-testid": "export-folder", key: "export-folder", icon: "download-alt", tooltip: "Export rules folder", onClick: () => setIsExporting('folder') }));
                }
                else if (isGroupView) {
                    actionIcons.push(React.createElement(ActionIcon, { "aria-label": "export rule group", "data-testid": "export-group", key: "export-group", icon: "download-alt", tooltip: "Export rule group", onClick: () => setIsExporting('group') }));
                }
            }
        }
    }
    else if (canEditRules(rulesSource.name) && hasRuler(rulesSource)) {
        if (!isFederated) {
            actionIcons.push(React.createElement(ActionIcon, { "aria-label": "edit rule group", "data-testid": "edit-group", key: "edit", icon: "pen", tooltip: "edit rule group", onClick: () => setIsEditingGroup(true) }));
            actionIcons.push(React.createElement(ActionIcon, { "aria-label": "re-order rules", "data-testid": "reorder-group", key: "reorder", icon: "exchange-alt", tooltip: "re-order rules", className: styles.rotate90, onClick: () => setIsReorderingGroup(true) }));
        }
        actionIcons.push(React.createElement(ActionIcon, { "aria-label": "delete rule group", "data-testid": "delete-group", key: "delete-group", icon: "trash-alt", tooltip: "delete rule group", onClick: () => setIsDeletingGroup(true) }));
    }
    // ungrouped rules are rules that are in the "default" group name
    const groupName = isListView ? (React.createElement(RuleLocation, { namespace: namespace.name })) : (React.createElement(RuleLocation, { namespace: namespace.name, group: group.name }));
    const closeEditModal = (saved = false) => {
        if (!saved) {
            logInfo(LogMessages.leavingRuleGroupEdit);
        }
        setIsEditingGroup(false);
    };
    return (React.createElement("div", { className: styles.wrapper, "data-testid": "rule-group" },
        React.createElement("div", { className: styles.header, "data-testid": "rule-group-header" },
            React.createElement(CollapseToggle, { size: "sm", className: styles.collapseToggle, isCollapsed: isCollapsed, onToggle: setIsCollapsed, "data-testid": "group-collapse-toggle" }),
            React.createElement(Icon, { name: isCollapsed ? 'folder' : 'folder-open' }),
            isCloudRulesSource(rulesSource) && (React.createElement(Tooltip, { content: rulesSource.name, placement: "top" },
                React.createElement("img", { alt: rulesSource.meta.name, className: styles.dataSourceIcon, src: rulesSource.meta.info.logos.small }))),
            // eslint-disable-next-line
            React.createElement("div", { className: styles.groupName, onClick: () => setIsCollapsed(!isCollapsed) },
                isFederated && React.createElement(Badge, { color: "purple", text: "Federated" }),
                " ",
                groupName),
            React.createElement("div", { className: styles.spacer }),
            React.createElement("div", { className: styles.headerStats },
                React.createElement(RuleGroupStats, { group: group })),
            isProvisioned && (React.createElement(React.Fragment, null,
                React.createElement("div", { className: styles.actionsSeparator }, "|"),
                React.createElement("div", { className: styles.actionIcons },
                    React.createElement(Badge, { color: "purple", text: "Provisioned" })))),
            !!actionIcons.length && (React.createElement(React.Fragment, null,
                React.createElement("div", { className: styles.actionsSeparator }, "|"),
                React.createElement("div", { className: styles.actionIcons },
                    React.createElement(Stack, { gap: 0.5 }, actionIcons))))),
        !isCollapsed && (React.createElement(RulesTable, { showSummaryColumn: true, className: styles.rulesTable, showGuidelines: true, showNextEvaluationColumn: Boolean(group.interval), rules: group.rules })),
        isEditingGroup && (React.createElement(EditCloudGroupModal, { namespace: namespace, group: group, onClose: () => closeEditModal(), folderUrl: (folder === null || folder === void 0 ? void 0 : folder.canEdit) ? makeFolderSettingsLink(folder) : undefined })),
        isReorderingGroup && (React.createElement(ReorderCloudGroupModal, { group: group, namespace: namespace, onClose: () => setIsReorderingGroup(false) })),
        React.createElement(ConfirmModal, { isOpen: isDeletingGroup, title: "Delete group", body: React.createElement("div", null,
                React.createElement("p", null,
                    "Deleting \"",
                    React.createElement("strong", null, group.name),
                    "\" will permanently remove the group and",
                    ' ',
                    group.rules.length,
                    " alert ",
                    pluralize('rule', group.rules.length),
                    " belonging to it."),
                React.createElement("p", null, "Are you sure you want to delete this group?")), onConfirm: deleteGroup, onDismiss: () => setIsDeletingGroup(false), confirmText: "Delete" }),
        folder && isExporting === 'folder' && (React.createElement(GrafanaRuleFolderExporter, { folder: folder, onClose: () => setIsExporting(undefined) })),
        folder && isExporting === 'group' && (React.createElement(GrafanaRuleGroupExporter, { folderUid: folder.uid, groupName: group.name, onClose: () => setIsExporting(undefined) }))));
});
RulesGroup.displayName = 'RulesGroup';
export const getStyles = (theme) => {
    return {
        wrapper: css ``,
        header: css `
      display: flex;
      flex-direction: row;
      align-items: center;
      padding: ${theme.spacing(1)} ${theme.spacing(1)} ${theme.spacing(1)} 0;
      flex-wrap: nowrap;
      border-bottom: 1px solid ${theme.colors.border.weak};

      &:hover {
        background-color: ${theme.components.table.rowHoverBackground};
      }
    `,
        headerStats: css `
      flex-shrink: 0;

      span {
        vertical-align: middle;
      }

      ${theme.breakpoints.down('sm')} {
        order: 2;
        width: 100%;
        padding-left: ${theme.spacing(1)};
      }
    `,
        groupName: css `
      margin-left: ${theme.spacing(1)};
      margin-bottom: 0;
      cursor: pointer;

      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `,
        spacer: css `
      flex: 1;
    `,
        collapseToggle: css `
      background: none;
      border: none;
      margin-top: -${theme.spacing(1)};
      margin-bottom: -${theme.spacing(1)};

      svg {
        margin-bottom: 0;
      }
    `,
        dataSourceIcon: css `
      width: ${theme.spacing(2)};
      height: ${theme.spacing(2)};
      margin-left: ${theme.spacing(2)};
    `,
        dataSourceOrigin: css `
      margin-right: 1em;
      color: ${theme.colors.text.disabled};
    `,
        actionsSeparator: css `
      margin: 0 ${theme.spacing(2)};
    `,
        actionIcons: css `
      width: 80px;
      align-items: center;

      flex-shrink: 0;
    `,
        rulesTable: css `
      margin: ${theme.spacing(2, 0)};
    `,
        rotate90: css `
      transform: rotate(90deg);
    `,
    };
};
//# sourceMappingURL=RulesGroup.js.map