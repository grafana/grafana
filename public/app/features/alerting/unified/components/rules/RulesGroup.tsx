import { CombinedRuleGroup, CombinedRuleNamespace } from 'app/types/unified-alerting';
import React, { FC, useState, useEffect } from 'react';
import { HorizontalGroup, Icon, Spinner, Tooltip, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { isGrafanaRulerRule } from '../../utils/rules';
import { CollapseToggle } from '../CollapseToggle';
import { RulesTable } from './RulesTable';
import { GRAFANA_RULES_SOURCE_NAME, isCloudRulesSource } from '../../utils/datasource';
import { ActionIcon } from './ActionIcon';
import { useHasRuler } from '../../hooks/useHasRuler';
import kbn from 'app/core/utils/kbn';
import { useFolder } from '../../hooks/useFolder';
import { RuleStats } from './RuleStats';
import { EditCloudGroupModal } from './EditCloudGroupModal';

interface Props {
  namespace: CombinedRuleNamespace;
  group: CombinedRuleGroup;
  expandAll: boolean;
}

export const RulesGroup: FC<Props> = React.memo(({ group, namespace, expandAll }) => {
  const { rulesSource } = namespace;
  const styles = useStyles2(getStyles);

  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(!expandAll);

  useEffect(() => {
    setIsCollapsed(!expandAll);
  }, [expandAll]);

  const hasRuler = useHasRuler();
  const rulerRule = group.rules[0]?.rulerRule;
  const folderUID = (rulerRule && isGrafanaRulerRule(rulerRule) && rulerRule.grafana_alert.namespace_uid) || undefined;
  const { folder } = useFolder(folderUID);

  // group "is deleting" if rules source has ruler, but this group has no rules that are in ruler
  const isDeleting = hasRuler(rulesSource) && !group.rules.find((rule) => !!rule.rulerRule);

  const actionIcons: React.ReactNode[] = [];

  // for grafana, link to folder views
  if (isDeleting) {
    actionIcons.push(
      <HorizontalGroup key="is-deleting">
        <Spinner />
        deleting
      </HorizontalGroup>
    );
  } else if (rulesSource === GRAFANA_RULES_SOURCE_NAME) {
    if (folderUID) {
      const baseUrl = `/dashboards/f/${folderUID}/${kbn.slugifyForUrl(namespace.name)}`;
      if (folder?.canSave) {
        actionIcons.push(
          <ActionIcon
            aria-label="edit folder"
            key="edit"
            icon="pen"
            tooltip="edit folder"
            to={baseUrl + '/settings'}
            target="__blank"
          />
        );
      }
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
  } else if (hasRuler(rulesSource)) {
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
  }

  const groupName = isCloudRulesSource(rulesSource) ? `${namespace.name} > ${group.name}` : namespace.name;

  return (
    <div className={styles.wrapper} data-testid="rule-group">
      <div className={styles.header} data-testid="rule-group-header">
        <CollapseToggle
          className={styles.collapseToggle}
          isCollapsed={isCollapsed}
          onToggle={setIsCollapsed}
          data-testid="group-collapse-toggle"
        />
        <Icon name={isCollapsed ? 'folder' : 'folder-open'} />
        {isCloudRulesSource(rulesSource) && (
          <Tooltip content={rulesSource.name} placement="top">
            <img
              alt={rulesSource.meta.name}
              className={styles.dataSourceIcon}
              src={rulesSource.meta.info.logos.small}
            />
          </Tooltip>
        )}
        <h6 className={styles.heading}>{groupName}</h6>
        <div className={styles.spacer} />
        <div className={styles.headerStats}>
          <RuleStats showInactive={false} group={group} />
        </div>
        {!!actionIcons.length && (
          <>
            <div className={styles.actionsSeparator}>|</div>
            <div className={styles.actionIcons}>{actionIcons}</div>
          </>
        )}
      </div>
      {!isCollapsed && (
        <RulesTable showSummaryColumn={true} className={styles.rulesTable} showGuidelines={true} rules={group.rules} />
      )}
      {isEditingGroup && (
        <EditCloudGroupModal group={group} namespace={namespace} onClose={() => setIsEditingGroup(false)} />
      )}
    </div>
  );
});

RulesGroup.displayName = 'RulesGroup';

export const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    & + & {
      margin-top: ${theme.spacing(2)};
    }
  `,
  header: css`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: ${theme.spacing(1)} ${theme.spacing(1)} ${theme.spacing(1)} 0;
    background-color: ${theme.colors.background.secondary};
    flex-wrap: wrap;
  `,
  headerStats: css`
    span {
      vertical-align: middle;
    }

    ${theme.breakpoints.down('sm')} {
      order: 2;
      width: 100%;
      padding-left: ${theme.spacing(1)};
    }
  `,
  heading: css`
    margin-left: ${theme.spacing(1)};
    margin-bottom: 0;
  `,
  spacer: css`
    flex: 1;
  `,
  collapseToggle: css`
    background: none;
    border: none;
    margin-top: -${theme.spacing(1)};
    margin-bottom: -${theme.spacing(1)};

    svg {
      margin-bottom: 0;
    }
  `,
  dataSourceIcon: css`
    width: ${theme.spacing(2)};
    height: ${theme.spacing(2)};
    margin-left: ${theme.spacing(2)};
  `,
  dataSourceOrigin: css`
    margin-right: 1em;
    color: ${theme.colors.text.disabled};
  `,
  actionsSeparator: css`
    margin: 0 ${theme.spacing(2)};
  `,
  actionIcons: css`
    & > * + * {
      margin-left: ${theme.spacing(1)};
    }
  `,
  rulesTable: css`
    margin-top: ${theme.spacing(3)};
  `,
});
