import { useState } from 'react';

import { ConfirmModal, Dropdown, IconButton, Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { DataSourceRuleGroupIdentifier, GrafanaRuleGroupIdentifier } from 'app/types/unified-alerting';

import { alertRuleApi } from '../../api/alertRuleApi';
import { GRAFANA_RULER_CONFIG, featureDiscoveryApi } from '../../api/featureDiscoveryApi';
import { GrafanaRuleGroupExporter } from '../../components/export/GrafanaRuleGroupExporter';
import { EditRuleGroupModal } from '../../components/rules/EditRuleGroupModal';
import { ReorderCloudGroupModal } from '../../components/rules/ReorderRuleGroupModal';
import { useDeleteRuleGroup } from '../../hooks/ruleGroup/useDeleteRuleGroup';
import { useAsync } from '../../hooks/useAsync';
import { useFolder } from '../../hooks/useFolder';
import { useRulesAccess } from '../../utils/accessControlHooks';
import { GRAFANA_RULES_SOURCE_NAME, getRulesDataSourceByUID } from '../../utils/datasource';
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

type DataSourceActionState = 'edit' | 'reorder' | 'delete';

function DataSourceGroupsActionMenu({ groupIdentifier }: DataSourceGroupsActionMenuProps) {
  const { canEditRules } = useRulesAccess();
  const { data: dataSourceInfo } = useDiscoverDsFeaturesQuery({ uid: groupIdentifier.rulesSource.uid });

  const [actionState, setActionState] = useState<DataSourceActionState | undefined>(undefined);

  const [deleteRuleGroup] = useDeleteRuleGroup();
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

  const [{ execute: deleteGroup }] = useAsync(async () => {
    await deleteRuleGroup.execute({
      namespaceName: groupIdentifier.namespace.name,
      groupName: groupIdentifier.groupName,
      dataSourceName: groupIdentifier.rulesSource.name,
    });
  });

  const canEdit = !isFederated && canEditRules(groupIdentifier.rulesSource.name);
  const rulesSource = getRulesDataSourceByUID(groupIdentifier.rulesSource.uid);

  if (!rulesSource) {
    // This should never happen
    return null;
  }

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
            {canEdit && (
              <Menu.Item
                label={t('alerting.group-actions.delete', 'Delete')}
                icon="trash-alt"
                destructive
                onClick={() => setActionState('delete')}
              />
            )}
          </Menu>
        }
      >
        <IconButton name="ellipsis-h" aria-label={t('alerting.group-actions.actions-trigger', 'Rule group actions')} />
      </Dropdown>
      {actionState === 'edit' && rulerRuleGroup && (
        <EditRuleGroupModal
          namespace={{
            name: groupIdentifier.namespace.name,
            groups: [],
            rulesSource,
          }}
          group={rulerRuleGroup}
          onClose={() => setActionState(undefined)}
        />
      )}
      {actionState === 'reorder' && rulerRuleGroup && (
        <ReorderCloudGroupModal
          group={rulerRuleGroup}
          groupIdentifier={groupIdentifier}
          onClose={() => setActionState(undefined)}
          rulerConfig={dataSourceInfo.rulerConfig}
        />
      )}
      {rulerRuleGroup && (
        <ConfirmModal
          isOpen={actionState === 'delete'}
          title="Delete group"
          body={<div>Are you sure you want to delete this group?</div>}
          onConfirm={deleteGroup}
          onDismiss={() => setActionState(undefined)}
          confirmText="Delete"
        />
      )}
    </>
  );
}

type GrafanaActionState = 'edit' | 'reorder' | 'export';

function GrafanaGroupsActionMenu({ groupIdentifier }: GrafanaGroupsActionMenuProps) {
  const { canEditRules } = useRulesAccess();
  const { data: rulerRuleGroup } = useGetGrafanaRulerGroupQuery({
    folderUid: groupIdentifier.namespace.uid,
    groupName: groupIdentifier.groupName,
  });

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
      {actionState === 'export' && (
        <GrafanaRuleGroupExporter
          folderUid={folderUid}
          groupName={groupIdentifier.groupName}
          onClose={() => setActionState(undefined)}
        />
      )}
    </>
  );
}
