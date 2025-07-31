import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Badge, Icon, Spinner, Stack, Tooltip, useStyles2 } from '@grafana/ui';
import { CombinedRuleGroup, CombinedRuleNamespace, RulesSource } from 'app/types/unified-alerting';

import { useFolder } from '../../hooks/useFolder';
import { useHasRuler } from '../../hooks/useHasRuler';
import { useRulesAccess } from '../../utils/accessControlHooks';
import { GRAFANA_RULES_SOURCE_NAME, getRulesSourceName, isCloudRulesSource } from '../../utils/datasource';
import { makeFolderLink } from '../../utils/misc';
import { groups } from '../../utils/navigation';
import { isFederatedRuleGroup, isPluginProvidedRule, rulerRuleType } from '../../utils/rules';
import { CollapseToggle } from '../CollapseToggle';
import { RuleLocation } from '../RuleLocation';
import { GrafanaRuleFolderExporter } from '../export/GrafanaRuleFolderExporter';
import { decodeGrafanaNamespace } from '../expressions/util';
import { FolderActionsButton } from '../folder-actions/FolderActionsButton';

import { ActionIcon } from './ActionIcon';
import { RuleGroupStats } from './RuleStats';
import { RulesTable, useIsRulesLoading } from './RulesTable';

type ViewMode = 'grouped' | 'list';

interface Props {
  namespace: CombinedRuleNamespace;
  group: CombinedRuleGroup;
  expandAll: boolean;
  viewMode: ViewMode;
}

export const RulesGroup = React.memo(({ group, namespace, expandAll, viewMode }: Props) => {
  const { rulesSource } = namespace;
  const rulesSourceName = getRulesSourceName(rulesSource);
  const rulerRulesLoaded = useIsRulesLoading(rulesSource);

  const styles = useStyles2(getStyles);

  const [isExporting, setIsExporting] = useState<'folder' | undefined>(undefined);
  const [isCollapsed, setIsCollapsed] = useState(!expandAll);

  useEffect(() => {
    setIsCollapsed(!expandAll);
  }, [expandAll]);

  const { hasRuler } = useHasRuler(namespace.rulesSource);

  const rulerRule = group.rules[0]?.rulerRule;
  const folderUID =
    (rulerRule && rulerRuleType.grafana.rule(rulerRule) && rulerRule.grafana_alert.namespace_uid) || undefined;
  const { folder } = useFolder(folderUID);

  const { canEditRules } = useRulesAccess();

  // group "is deleting" if rules source has ruler, but this group has no rules that are in ruler
  const isDeleting = hasRuler && rulerRulesLoaded && !group.rules.find((rule) => !!rule.rulerRule);
  const isFederated = isFederatedRuleGroup(group);

  // check if group has provisioned items
  const isProvisioned = group.rules.some((rule) => {
    return rulerRuleType.grafana.rule(rule.rulerRule) && rule.rulerRule.grafana_alert.provenance;
  });
  const isPluginProvided = group.rules.some((rule) => isPluginProvidedRule(rule.rulerRule ?? rule.promRule));

  const canEditGroup = hasRuler && !isProvisioned && !isFederated && !isPluginProvided && canEditRules(rulesSourceName);

  // check what view mode we are in
  const isListView = viewMode === 'list';
  const isGroupView = viewMode === 'grouped';

  const actionIcons: React.ReactNode[] = [];

  // for grafana, link to folder views
  if (isDeleting) {
    actionIcons.push(
      <Stack key="is-deleting">
        <Spinner />
        <Trans i18nKey="alerting.rules-group.deleting">Deleting</Trans>
      </Stack>
    );
  } else if (rulesSource === GRAFANA_RULES_SOURCE_NAME) {
    if (folderUID) {
      const baseUrl = makeFolderLink(folderUID);
      if (isGroupView) {
        actionIcons.push(
          <ActionIcon
            aria-label={t('alerting.rule-group-action.details', 'rule group details')}
            key="rule-group-details"
            icon="info-circle"
            tooltip={t('alerting.rule-group-action.details', 'rule group details')}
            to={groups.detailsPageLink('grafana', folderUID, group.name, { includeReturnTo: true })}
          />
        );
        if (folder?.canSave && canEditGroup) {
          actionIcons.push(
            <ActionIcon
              aria-label={t('alerting.rule-group-action.edit', 'edit rule group')}
              key="rule-group-edit"
              icon="pen"
              tooltip={t('alerting.rule-group-action.edit', 'edit rule group')}
              to={groups.editPageLink('grafana', folderUID, group.name, { includeReturnTo: true })}
            />
          );
        }
      }
      if (folder?.canSave) {
        if (isListView) {
          actionIcons.push(
            <ActionIcon
              aria-label={t('alerting.rule-group-action.go-to-folder', 'go to folder')}
              key="goto"
              icon="folder-open"
              tooltip={t('alerting.rule-group-action.go-to-folder', 'go to folder')}
              to={baseUrl}
              target="__blank"
            />
          );

          if (folder?.canAdmin) {
            actionIcons.push(
              <ActionIcon
                aria-label={t('alerting.rule-group-action.manage-permissions', 'manage permissions')}
                key="manage-perms"
                icon="lock"
                tooltip={t('alerting.rule-group-action.manage-permissions', 'manage permissions')}
                to={baseUrl + '/permissions'}
                target="__blank"
              />
            );
          }
        }
      }
      if (folder) {
        if (isListView) {
          actionIcons.push(<FolderActionsButton folderUID={folderUID} key="folder-bulk-actions" />);
        }
      }
    }
  } else {
    actionIcons.push(
      <ActionIcon
        aria-label={t('alerting.rule-group-action.details', 'rule group details')}
        key="rule-group-details"
        icon="info-circle"
        tooltip={t('alerting.rule-group-action.details', 'rule group details')}
        to={groups.detailsPageLink(rulesSource.uid, namespace.name, group.name, { includeReturnTo: true })}
      />
    );
    if (canEditGroup) {
      actionIcons.push(
        <ActionIcon
          aria-label={t('alerting.rule-group-action.edit', 'edit rule group')}
          key="rule-group-edit"
          icon="pen"
          tooltip={t('alerting.rule-group-action.edit', 'edit rule group')}
          to={groups.editPageLink(rulesSource.uid, namespace.name, group.name, { includeReturnTo: true })}
        />
      );
    }
  }

  // ungrouped rules are rules that are in the "default" group name
  const groupName = isListView ? (
    <RuleLocation namespace={decodeGrafanaNamespace(namespace).name} />
  ) : (
    <RuleLocation namespace={decodeGrafanaNamespace(namespace).name} group={group.name} />
  );

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
            {isFederated && <Badge color="purple" text={t('alerting.rules-group.text-federated', 'Federated')} />}{' '}
            {groupName}
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
              <Badge color="purple" text={t('alerting.rules-group.text-provisioned', 'Provisioned')} />
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
      {folder && isExporting === 'folder' && (
        <GrafanaRuleFolderExporter folder={folder} onClose={() => setIsExporting(undefined)} />
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
      width: '120px',
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
