import { useMemo, useState } from 'react';

import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, type Column, EmptyState, InteractiveTable, Stack, Tooltip } from '@grafana/ui';
import { type RuleGroupIdentifierV2 } from 'app/types/unified-alerting';
import { type GrafanaRuleDefinition, type RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { trackDeletedRuleRestoreFail, trackDeletedRuleRestoreSuccess } from '../../../Analytics';
import { shouldAllowPermanentlyDeletingRules } from '../../../featureToggles';
import { isAvailable, isGranted } from '../../../hooks/abilities/abilityUtils';
import { useRuleAdministrationAbility } from '../../../hooks/abilities/rules/rulerRuleAbilities';
import { isInsufficientPermissions } from '../../../hooks/abilities/types';
import { UpdatedByUser } from '../../rule-viewer/tabs/version-history/UpdatedBy';

import { ConfirmDeletedPermanentlyModal } from './ConfirmDeletePermanantlyModal';
import { ConfirmRestoreDeletedRuleModal } from './ConfirmRestoreDeletedRuleModal';

const DELETED_RULES_PAGE_SIZE = 30;

interface DeletedRulesProps {
  deletedRules: Array<RulerGrafanaRuleDTO<GrafanaRuleDefinition>>;
}
export function DeletedRules({ deletedRules }: DeletedRulesProps) {
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoreRule, setRestoreRule] = useState<RulerGrafanaRuleDTO | undefined>();
  const [guidToDelete, setGuidToDelete] = useState<string | undefined>();

  const confirmDeletePermanently = guidToDelete !== undefined;
  const unknown = t('alerting.deleted-rules.unknown', 'Unknown');

  if (deletedRules.length === 0) {
    return (
      <EmptyState
        message={t('alerting.deleted-rules.empty-state-title', 'No recently deleted rules found')}
        variant="not-found"
      />
    );
  }

  const showConfirmation = (id: string) => {
    const ruleTorestore = deletedRules.find((rule) => getRowId(rule.grafana_alert) === id);
    if (!ruleTorestore) {
      return;
    }

    setConfirmRestore(true);
    setRestoreRule(ruleTorestore);
  };

  const hideConfirmationForRestore = () => {
    setConfirmRestore(false);
  };
  const hideConfirmationForDelete = () => {
    setGuidToDelete(undefined);
  };

  const showDeleteConfirmation = (id: string) => {
    const ruleTorestore = deletedRules.find((rule) => getRowId(rule.grafana_alert) === id);
    if (!ruleTorestore) {
      return;
    }

    setGuidToDelete(ruleTorestore.grafana_alert.guid);
  };

  const columns: Array<Column<(typeof deletedRules)[0]>> = [
    {
      id: 'createdBy',
      header: t('alerting.deleted-rules.table.updatedBy', 'Deleted By'),
      disableGrow: true,
      cell: ({ row }) => {
        return <UpdatedByUser user={row.original.grafana_alert.updated_by} />;
      },
    },
    {
      id: 'title',
      header: t('alerting.deleted-rules.table.title', 'Title'),
      disableGrow: true,
      cell: ({ row }) => {
        return row.original.grafana_alert.title;
      },
    },
    {
      id: 'folder',
      header: t('alerting.deleted-rules.table.folder', 'Folder'),
      disableGrow: true,
      cell: ({ row }) => {
        return row.original.grafana_alert.namespace_uid;
      },
    },
    {
      id: 'group',
      header: t('alerting.deleted-rules.table.group', 'Group'),
      disableGrow: true,
      cell: ({ row }) => {
        return row.original.grafana_alert.rule_group;
      },
    },
    {
      id: 'created',
      header: t('alerting.deleted-rules.table.updated', 'Deletion Date'),
      disableGrow: true,
      cell: ({ row }) => {
        const value = row.original.grafana_alert.updated;
        if (!value) {
          return unknown;
        }
        return dateTimeFormat(value) + ' (' + dateTimeFormatTimeAgo(value) + ')';
      },
    },
    {
      id: 'actions',
      disableGrow: true,
      cell: ({ row }) => {
        return (
          <DeletedRuleActions
            rule={row.original}
            onRestore={() => showConfirmation(getRowId(row.original.grafana_alert))}
            onDeletePermanently={() => showDeleteConfirmation(getRowId(row.original.grafana_alert))}
          />
        );
      },
    },
  ];

  return (
    <>
      <InteractiveTable
        pageSize={DELETED_RULES_PAGE_SIZE}
        columns={columns}
        data={deletedRules}
        getRowId={(row) => {
          return getRowId(row.grafana_alert);
        }}
      />
      <ConfirmRestoreDeletedRuleModal
        ruleToRestore={restoreRule}
        isOpen={confirmRestore}
        onDismiss={hideConfirmationForRestore}
        onRestoreSucess={trackDeletedRuleRestoreSuccess}
        onRestoreError={trackDeletedRuleRestoreFail}
      />
      <ConfirmDeletedPermanentlyModal
        guid={guidToDelete}
        isOpen={confirmDeletePermanently}
        onDismiss={hideConfirmationForDelete}
      />
    </>
  );
}

interface DeletedRuleActionsProps {
  rule: RulerGrafanaRuleDTO<GrafanaRuleDefinition>;
  onRestore: () => void;
  onDeletePermanently: () => void;
}

function DeletedRuleActions({ rule, onRestore, onDeletePermanently }: DeletedRuleActionsProps) {
  const groupId = useMemo(
    (): RuleGroupIdentifierV2 => ({
      groupOrigin: 'grafana',
      groupName: rule.grafana_alert.rule_group,
      namespace: { uid: rule.grafana_alert.namespace_uid },
    }),
    [rule.grafana_alert.rule_group, rule.grafana_alert.namespace_uid]
  );

  const { deletePermanently: deletePermAbility } = useRuleAdministrationAbility(rule, groupId);

  const showPermanentDelete = shouldAllowPermanentlyDeletingRules() && isAvailable(deletePermAbility);

  const tooltipContent = isInsufficientPermissions(deletePermAbility)
    ? t('alerting.deleted-rules.permanently-delete-no-permission', 'Grafana Admin role required')
    : undefined;

  return (
    <Stack direction="row" alignItems="center" justifyContent="flex-end">
      <Button variant="secondary" size="sm" icon="history" onClick={onRestore}>
        <Trans i18nKey="alerting.deleted-rules.restore">Restore</Trans>
      </Button>
      {showPermanentDelete && (
        <Tooltip content={tooltipContent ?? ''} placement="top">
          <Button
            variant="destructive"
            size="sm"
            icon="trash-alt"
            disabled={!isGranted(deletePermAbility)}
            onClick={onDeletePermanently}
          >
            <Trans i18nKey="alerting.deleted-rules.permanently-delete">Permanently delete</Trans>
          </Button>
        </Tooltip>
      )}
    </Stack>
  );
}

function getRowId(row: GrafanaRuleDefinition) {
  return row.guid || row.uid;
}
