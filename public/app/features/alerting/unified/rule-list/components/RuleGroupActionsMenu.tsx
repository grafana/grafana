import { skipToken } from '@reduxjs/toolkit/query';

import { isFetchError } from '@grafana/runtime';
import { Dropdown, Icon, IconButton, LinkButton, Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { DataSourceRuleGroupIdentifier, GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';

import { alertRuleApi } from '../../api/alertRuleApi';
import { featureDiscoveryApi } from '../../api/featureDiscoveryApi';
import { useFolder } from '../../hooks/useFolder';
import { useRulesAccess } from '../../utils/accessControlHooks';
import { GRAFANA_RULES_SOURCE_NAME, getRulesDataSourceByUID } from '../../utils/datasource';
import { groups } from '../../utils/navigation';
import { isFederatedRuleGroup, isPluginProvidedGroup, isProvisionedRuleGroup } from '../../utils/rules';

import { GroupStatus } from './GroupStatus';
import { RuleActionsSkeleton } from './RuleActionsSkeleton';

const { useGetGrafanaRulerGroupQuery, useGetRuleGroupForNamespaceQuery } = alertRuleApi;
const { useDiscoverDsFeaturesQuery } = featureDiscoveryApi;

interface DataSourceGroupsActionMenuProps {
  groupIdentifier: DataSourceRuleGroupIdentifier;
}

interface GrafanaGroupsActionMenuProps {
  groupIdentifier: GrafanaRuleGroupIdentifier;
}

type RuleGroupActionsMenuProps = DataSourceGroupsActionMenuProps | GrafanaGroupsActionMenuProps;

export function RuleGroupActionsMenu({ groupIdentifier }: RuleGroupActionsMenuProps) {
  switch (groupIdentifier.groupOrigin) {
    case 'grafana':
      return <GrafanaGroupsActionMenu groupIdentifier={groupIdentifier} />;
    case 'datasource':
      return <DataSourceGroupsActionMenu groupIdentifier={groupIdentifier} />;
    default:
      return null;
  }
}

function DataSourceGroupsActionMenu({ groupIdentifier }: DataSourceGroupsActionMenuProps) {
  const { canEditRules } = useRulesAccess();
  const { data: dataSourceInfo } = useDiscoverDsFeaturesQuery({ uid: groupIdentifier.rulesSource.uid });

  const {
    data: rulerRuleGroup,
    error: rulerGroupError,
    isLoading: isRulerGroupLoading,
  } = useGetRuleGroupForNamespaceQuery(
    dataSourceInfo?.rulerConfig
      ? {
          namespace: groupIdentifier.namespace.name,
          group: groupIdentifier.groupName,
          rulerConfig: dataSourceInfo?.rulerConfig!,
        }
      : skipToken
  );

  const isFederated = rulerRuleGroup ? isFederatedRuleGroup(rulerRuleGroup) : false;
  const isPluginProvided = rulerRuleGroup ? isPluginProvidedGroup(rulerRuleGroup) : false;

  const canEdit = !isFederated && !isPluginProvided && canEditRules(groupIdentifier.rulesSource.name);
  const rulesSource = getRulesDataSourceByUID(groupIdentifier.rulesSource.uid);

  if (!rulesSource) {
    // This should never happen
    return null;
  }

  // We don't provide any actions if the data source doesn't support ruler
  if (!dataSourceInfo?.rulerConfig) {
    return null;
  }

  if (isRulerGroupLoading) {
    return <RuleActionsSkeleton />;
  }

  if (rulerGroupError) {
    if (isFetchError(rulerGroupError) && rulerGroupError.status === 404) {
      return <GroupStatus status="deleting" />;
    }

    return (
      <Icon
        name="exclamation-triangle"
        title={t('alerting.group-actions-menu.group-load-failed', 'Failed to load group details')}
      />
    );
  }

  // This should never happen. Loading and error states are handled above
  if (!rulerRuleGroup) {
    return <Icon name="exclamation-triangle" title={t('alerting.group-actions-menu.unknown-error', 'Unknown error')} />;
  }

  return (
    <Dropdown
      placement="right-start"
      overlay={
        <Menu>
          <Menu.Item
            label={t('alerting.group-actions.details', 'Details')}
            icon="info-circle"
            data-testid="details-group-action"
            url={groups.detailsPageLink(rulesSource.uid, groupIdentifier.namespace.name, groupIdentifier.groupName)}
          />
          {canEdit && (
            <Menu.Item
              label={t('alerting.group-actions.edit', 'Edit')}
              icon="pen"
              data-testid="edit-group-action"
              url={groups.editPageLink(rulesSource.uid, groupIdentifier.namespace.name, groupIdentifier.groupName)}
            />
          )}
        </Menu>
      }
    >
      <IconButton name="ellipsis-h" aria-label={t('alerting.group-actions.actions-trigger', 'Rule group actions')} />
    </Dropdown>
  );
}

function GrafanaGroupsActionMenu({ groupIdentifier }: GrafanaGroupsActionMenuProps) {
  const { canEditRules } = useRulesAccess();
  const { data: rulerRuleGroup } = useGetGrafanaRulerGroupQuery({
    folderUid: groupIdentifier.namespace.uid,
    groupName: groupIdentifier.groupName,
  });

  const isProvisioned = rulerRuleGroup ? isProvisionedRuleGroup(rulerRuleGroup) : false;
  const isPluginProvided = rulerRuleGroup ? isPluginProvidedGroup(rulerRuleGroup) : false;

  const folderUid = groupIdentifier.namespace.uid;
  const { folder } = useFolder(folderUid);

  const canEdit = folder?.canSave && !isProvisioned && !isPluginProvided && canEditRules(GRAFANA_RULES_SOURCE_NAME);

  if (!canEdit) {
    return null;
  }

  return (
    <LinkButton
      icon="pen"
      variant="secondary"
      size="sm"
      href={groups.editPageLink(GRAFANA_RULES_SOURCE_NAME, folderUid, groupIdentifier.groupName)}
    >
      {t('alerting.group-actions.edit', 'Edit')}
    </LinkButton>
  );
}
