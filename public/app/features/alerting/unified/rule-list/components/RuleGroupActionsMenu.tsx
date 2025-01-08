import { useState } from 'react';

import { Dropdown, IconButton, Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { DataSourceRuleGroupIdentifier, GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';

import { alertRuleApi } from '../../api/alertRuleApi';
import { GRAFANA_RULER_CONFIG, featureDiscoveryApi } from '../../api/featureDiscoveryApi';
import { EditRuleGroupModal } from '../../components/rules/EditRuleGroupModal';
import { ReorderCloudGroupModal } from '../../components/rules/ReorderRuleGroupModal';
import { useFolder } from '../../hooks/useFolder';
import { useRulesAccess } from '../../utils/accessControlHooks';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { isFederatedRuleGroup } from '../../utils/rules';

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

  const { data: rulerRuleGroup } = useGetRuleGroupForNamespaceQuery(
    {
      namespace: groupIdentifier.namespace.name,
      group: groupIdentifier.groupName,
      rulerConfig: dataSourceInfo?.rulerConfig!,
    },
    { skip: !dataSourceInfo?.rulerConfig }
  );

  const isFederated = rulerRuleGroup ? isFederatedRuleGroup(rulerRuleGroup) : false;

  if (!dataSourceInfo?.rulerConfig) {
    return null;
  }

  const canEdit = !isFederated && canEditRules(groupIdentifier.rulesSource.name);

  return (
    <Dropdown
      overlay={
        <Menu>
          {canEdit && (
            <Menu.Item label={t('alerting.group-actions.edit', 'Edit')} icon="pen" data-testid="edit-group-action" />
          )}
          {canEdit && <Menu.Item label={t('alerting.group-actions.reorder', 'Re-order rules')} icon="flip" />}
          <Menu.Divider />
          {canEdit && <Menu.Item label={t('alerting.group-actions.delete', 'Delete')} icon="trash-alt" destructive />}
        </Menu>
      }
    >
      <IconButton name="ellipsis-h" aria-label={t('alerting.group-actions.actions-trigger', 'Rule group actions')} />
    </Dropdown>
  );
}

type GrafanaActionState = 'edit' | 'reorder' | 'export';

function GrafanaGroupsActionMenu({ groupIdentifier }: GrafanaGroupsActionMenuProps) {
  const { canEditRules } = useRulesAccess();
  const { data: rulerRuleGroup } = useGetGrafanaRulerGroupQuery(groupIdentifier);

  const [actionState, setActionState] = useState<GrafanaActionState | undefined>(undefined);

  const isProvisioned = rulerRuleGroup?.rules.some((r) => Boolean(r.grafana_alert.provenance));

  const folderUid = groupIdentifier.namespace.uid;
  const { folder } = useFolder(folderUid);

  const canEdit = folder?.canSave && !isProvisioned && canEditRules(GRAFANA_RULES_SOURCE_NAME);

  return (
    <>
      <Dropdown
        overlay={
          <Menu>
            {canEdit && (
              <Menu.Item
                label={t('alerting.group-actions.edit', 'Edit')}
                icon="pen"
                data-testid="edit-group-action"
                onClick={() => setActionState('edit')}
              />
            )}
            {canEdit && (
              <Menu.Item
                label={t('alerting.group-actions.reorder', 'Re-order rules')}
                icon="flip"
                onClick={() => setActionState('reorder')}
              />
            )}
            <Menu.Divider />
            <Menu.Item
              label={t('alerting.group-actions.export', 'Export')}
              icon="download-alt"
              onClick={() => setActionState('export')}
            />
          </Menu>
        }
      >
        <IconButton name="ellipsis-h" aria-label={t('alerting.group-actions.actions-trigger', 'Rule group actions')} />
      </Dropdown>
      {actionState === 'edit' && rulerRuleGroup && (
        <EditRuleGroupModal
          namespace={{
            rulesSource: GRAFANA_RULES_SOURCE_NAME,
            name: folder?.title ?? '',
            groups: [],
          }}
          group={rulerRuleGroup}
          onClose={() => setActionState(undefined)}
          folderUid={groupIdentifier.namespace.uid}
        />
      )}
      {actionState === 'reorder' && rulerRuleGroup && (
        <ReorderCloudGroupModal
          group={rulerRuleGroup}
          groupIdentifier={groupIdentifier}
          onClose={() => setActionState(undefined)}
          rulerConfig={GRAFANA_RULER_CONFIG}
        />
      )}
    </>
  );
}
