import { css } from '@emotion/css';
import pluralize from 'pluralize';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Badge, ConfirmModal, Icon, Spinner, Stack, Tooltip, useStyles2 } from '@grafana/ui';
import { CombinedRuleGroup, CombinedRuleNamespace, RuleGroupIdentifier, RulesSource } from 'app/types/unified-alerting';

import { LogMessages, logInfo } from '../../Analytics';
import { featureDiscoveryApi } from '../../api/featureDiscoveryApi';
import { useDeleteRuleGroup } from '../../hooks/ruleGroup/useDeleteRuleGroup';
import { useFolder } from '../../hooks/useFolder';
import { useHasRuler } from '../../hooks/useHasRuler';
import { useRulesAccess } from '../../utils/accessControlHooks';
import { GRAFANA_RULES_SOURCE_NAME, getRulesSourceName, isCloudRulesSource } from '../../utils/datasource';
import { makeFolderLink, makeFolderSettingsLink } from '../../utils/misc';
import { isFederatedRuleGroup, isGrafanaRulerRule } from '../../utils/rules';
import { CollapseToggle } from '../CollapseToggle';
import { RuleLocation } from '../RuleLocation';
import { GrafanaRuleFolderExporter } from '../export/GrafanaRuleFolderExporter';
import { GrafanaRuleGroupExporter } from '../export/GrafanaRuleGroupExporter';
import { decodeGrafanaNamespace } from '../expressions/util';

import { ActionIcon } from './ActionIcon';
import { EditRuleGroupModal } from './EditRuleGroupModal';
import { ReorderCloudGroupModal } from './ReorderRuleGroupModal';
import { RuleGroupStats } from './RuleStats';
import { RulesTable } from './RulesTable';

type ViewMode = 'grouped' | 'list';

interface Props {
  namespace: CombinedRuleNamespace;
  group: CombinedRuleGroup;
  expandAll: boolean;
  viewMode: ViewMode;
}

const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;

export const RulesGroup = React.memo(({ group, namespace, expandAll, viewMode }: Props) => {
  const { rulesSource } = namespace;
  const rulesSourceName = getRulesSourceName(rulesSource);

  const [deleteRuleGroup] = useDeleteRuleGroup();
  const styles = useStyles2(getStyles);

  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [isReorderingGroup, setIsReorderingGroup] = useState(false);
  const [isExporting, setIsExporting] = useState<'group' | 'folder' | undefined>(undefined);
  const [isCollapsed, setIsCollapsed] = useState(!expandAll);

  const { canEditRules } = useRulesAccess();

  useEffect(() => {
    setIsCollapsed(!expandAll);
  }, [expandAll]);

  const { hasRuler, rulerRulesLoaded } = useHasRuler(namespace.rulesSource);
  const { currentData: dsFeatures } = useDiscoverDsFeaturesQuery({ rulesSourceName });

  const rulerRule = group.rules[0]?.rulerRule;
  const folderUID = (rulerRule && isGrafanaRulerRule(rulerRule) && rulerRule.grafana_alert.namespace_uid) || undefined;
  const { folder } = useFolder(folderUID);

  // group "is deleting" if rules source has ruler, but this group has no rules that are in ruler
  const isDeleting = hasRuler && rulerRulesLoaded && !group.rules.find((rule) => !!rule.rulerRule);
  const isFederated = isFederatedRuleGroup(group);

  // check if group has provisioned items
  const isProvisioned = group.rules.some((rule) => {
    return isGrafanaRulerRule(rule.rulerRule) && rule.rulerRule.grafana_alert.provenance;
  });

  // check what view mode we are in
  const isListView = viewMode === 'list';
  const isGroupView = viewMode === 'grouped';

  const deleteGroup = async () => {
    const namespaceName = decodeGrafanaNamespace(namespace).name;
    const groupName = group.name;
    const dataSourceName = getRulesSourceName(namespace.rulesSource);

    const ruleGroupIdentifier: RuleGroupIdentifier = { namespaceName, groupName, dataSourceName };
    await deleteRuleGroup.execute(ruleGroupIdentifier);
    setIsDeletingGroup(false);
  };

  const actionIcons: React.ReactNode[] = [];

  // for grafana, link to folder views
  if (isDeleting) {
    actionIcons.push(
      <Stack key="is-deleting">
        <Spinner />
        deleting
      </Stack>
    );
  } else if (rulesSource === GRAFANA_RULES_SOURCE_NAME) {
    if (folderUID) {
      const baseUrl = makeFolderLink(folderUID);
      if (folder?.canSave) {
        if (isGroupView && !isProvisioned) {
          actionIcons.push(
            <ActionIcon
              aria-label="edit rule group"
              data-testid="edit-group"
              key="edit"
              icon="pen"
              tooltip="edit rule group"
              onClick={() => setIsEditingGroup(true)}
            />
          );
          actionIcons.push(
            <ActionIcon
              data-testid="reorder-group"
              key="reorder"
              icon="exchange-alt"
              tooltip="reorder rules"
              className={styles.rotate90}
              onClick={() => setIsReorderingGroup(true)}
            />
          );
        }
        if (isListView) {
          actionIcons.push(
            <ActionIcon
              aria-label="go to folder"
              key="goto"
              icon="folder-open"
              tooltip="go to folder"
              to={baseUrl}
              target="__blank"
            />
          );

          if (folder?.canAdmin) {
            actionIcons.push(
              <ActionIcon
                aria-label="manage permissions"
                key="manage-perms"
                icon="lock"
                tooltip="manage permissions"
                to={baseUrl + '/permissions'}
                target="__blank"
              />
            );
          }
        }
      }
      if (folder) {
        if (isListView) {
          actionIcons.push(
            <ActionIcon
              aria-label="export rule folder"
              data-testid="export-folder"
              key="export-folder"
              icon="download-alt"
              tooltip="Export rules folder"
              onClick={() => setIsExporting('folder')}
            />
          );
        } else if (isGroupView) {
          actionIcons.push(
            <ActionIcon
              aria-label="export rule group"
              data-testid="export-group"
              key="export-group"
              icon="download-alt"
              tooltip="Export rule group"
              onClick={() => setIsExporting('group')}
            />
          );
        }
      }
    }
  } else if (canEditRules(rulesSource.name) && hasRuler) {
    if (!isFederated) {
      actionIcons.push(
        <ActionIcon
          aria-label="edit rule group"
          data-testid="edit-group"
          key="edit"
          icon="pen"
          tooltip="edit rule group"
          onClick={() => setIsEditingGroup(true)}
        />
      );
      actionIcons.push(
        <ActionIcon
          data-testid="reorder-group"
          key="reorder"
          icon="exchange-alt"
          tooltip="reorder rules"
          className={styles.rotate90}
          onClick={() => setIsReorderingGroup(true)}
        />
      );
    }

    actionIcons.push(
      <ActionIcon
        aria-label="delete rule group"
        data-testid="delete-group"
        key="delete-group"
        icon="trash-alt"
        tooltip="delete rule group"
        onClick={() => setIsDeletingGroup(true)}
      />
    );
  }

  // ungrouped rules are rules that are in the "default" group name
  const groupName = isListView ? (
    <RuleLocation namespace={decodeGrafanaNamespace(namespace).name} />
  ) : (
    <RuleLocation namespace={decodeGrafanaNamespace(namespace).name} group={group.name} />
  );

  const closeEditModal = (saved = false) => {
    if (!saved) {
      logInfo(LogMessages.leavingRuleGroupEdit);
    }
    setIsEditingGroup(false);
  };

  return (
    <div className={styles.wrapper} data-testid="rule-group">
      <div className={styles.header} data-testid="rule-group-header">
        <CollapseToggle
          size="sm"
          className={styles.collapseToggle}
          isCollapsed={isCollapsed}
          onToggle={setIsCollapsed}
          data-testid={selectors.components.AlertRules.groupToggle}
        />
        <FolderIcon isCollapsed={isCollapsed} />
        <CloudSourceLogo rulesSource={rulesSource} />
        {
          // eslint-disable-next-line
          <div className={styles.groupName} onClick={() => setIsCollapsed(!isCollapsed)}>
            {isFederated && <Badge color="purple" text="Federated" />} {groupName}
          </div>
        }
        <div className={styles.spacer} />
        <div className={styles.headerStats}>
          <RuleGroupStats group={group} />
        </div>
        {isProvisioned && (
          <>
            <div className={styles.actionsSeparator}>|</div>
            <div className={styles.actionIcons}>
              <Badge color="purple" text="Provisioned" />
            </div>
          </>
        )}
        {!!actionIcons.length && (
          <>
            <div className={styles.actionsSeparator}>|</div>
            <div className={styles.actionIcons}>
              <Stack gap={0.5}>{actionIcons}</Stack>
            </div>
          </>
        )}
      </div>
      {!isCollapsed && (
        <RulesTable
          showSummaryColumn={true}
          className={styles.rulesTable}
          showGuidelines={true}
          showNextEvaluationColumn={Boolean(group.interval)}
          rules={group.rules}
        />
      )}
      {isEditingGroup && (
        <EditRuleGroupModal
          namespace={namespace}
          group={group}
          onClose={() => closeEditModal()}
          folderUrl={folder?.canEdit ? makeFolderSettingsLink(folder.uid) : undefined}
          folderUid={folderUID}
        />
      )}
      {isReorderingGroup && dsFeatures?.rulerConfig && (
        <ReorderCloudGroupModal
          group={group}
          folderUid={folderUID}
          namespace={namespace}
          onClose={() => setIsReorderingGroup(false)}
          rulerConfig={dsFeatures.rulerConfig}
        />
      )}
      <ConfirmModal
        isOpen={isDeletingGroup}
        title="Delete group"
        body={
          <div>
            <p>
              Deleting &quot;<strong>{group.name}</strong>&quot; will permanently remove the group and{' '}
              {group.rules.length} alert {pluralize('rule', group.rules.length)} belonging to it.
            </p>
            <p>Are you sure you want to delete this group?</p>
          </div>
        }
        onConfirm={deleteGroup}
        onDismiss={() => setIsDeletingGroup(false)}
        confirmText="Delete"
      />
      {folder && isExporting === 'folder' && (
        <GrafanaRuleFolderExporter folder={folder} onClose={() => setIsExporting(undefined)} />
      )}
      {folder && isExporting === 'group' && (
        <GrafanaRuleGroupExporter
          folderUid={folder.uid}
          groupName={group.name}
          onClose={() => setIsExporting(undefined)}
        />
      )}
    </div>
  );
});

RulesGroup.displayName = 'RulesGroup';

// It's a simple component but we render 80 of them on the list page it needs to be fast
// The Tooltip component is expensive to render and the rulesSource doesn't change often
// so memoization seems to bring a lot of benefit here
const CloudSourceLogo = React.memo(({ rulesSource }: { rulesSource: RulesSource | string }) => {
  const styles = useStyles2(getStyles);

  if (isCloudRulesSource(rulesSource)) {
    return (
      <Tooltip content={rulesSource.name} placement="top">
        <img alt={rulesSource.meta.name} className={styles.dataSourceIcon} src={rulesSource.meta.info.logos.small} />
      </Tooltip>
    );
  }

  return null;
});

CloudSourceLogo.displayName = 'CloudSourceLogo';

// We render a lot of these on the list page, and the Icon component does quite a bit of work
// to render its contents
const FolderIcon = React.memo(({ isCollapsed }: { isCollapsed: boolean }) => {
  return <Icon name={isCollapsed ? 'folder' : 'folder-open'} />;
});

FolderIcon.displayName = 'FolderIcon';

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({}),
    header: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      padding: `${theme.spacing(1)} ${theme.spacing(1)} ${theme.spacing(1)} 0`,
      flexWrap: 'nowrap',
      borderBottom: `1px solid ${theme.colors.border.weak}`,

      '&:hover': {
        backgroundColor: theme.components.table.rowHoverBackground,
      },
    }),
    headerStats: css({
      flexShrink: 0,

      span: {
        verticalAlign: 'middle',
      },

      [theme.breakpoints.down('sm')]: {
        order: 2,
        width: '100%',
        paddingLeft: theme.spacing(1),
      },
    }),
    groupName: css({
      marginLeft: theme.spacing(1),
      marginBottom: 0,
      cursor: 'pointer',

      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    spacer: css({
      flex: 1,
    }),
    collapseToggle: css({
      background: 'none',
      border: 'none',
      marginTop: `-${theme.spacing(1)}`,
      marginBottom: `-${theme.spacing(1)}`,

      svg: {
        marginBottom: 0,
      },
    }),
    dataSourceIcon: css({
      width: theme.spacing(2),
      height: theme.spacing(2),
      marginLeft: theme.spacing(2),
    }),
    dataSourceOrigin: css({
      marginRight: '1em',
      color: theme.colors.text.disabled,
    }),
    actionsSeparator: css({
      margin: `0 ${theme.spacing(2)}`,
    }),
    actionIcons: css({
      width: '80px',
      alignItems: 'center',

      flexShrink: 0,
    }),
    rulesTable: css({
      margin: theme.spacing(2, 0),
    }),
    rotate90: css({
      transform: 'rotate(90deg)',
    }),
  };
};
