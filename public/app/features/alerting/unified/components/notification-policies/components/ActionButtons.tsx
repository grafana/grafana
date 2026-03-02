import { type JSX, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { LinkButton, Stack, Tooltip } from '@grafana/ui';

import { ROUTES_META_SYMBOL, Route } from '../../../../../../plugins/datasource/alertmanager/types';
import { AlertmanagerAction, useAlertmanagerAbilities } from '../../../hooks/useAbilities';
import { ROOT_ROUTE_NAME } from '../../../utils/k8s/constants';
import { createRelativeUrl } from '../../../utils/url';
import ConditionalWrap from '../../ConditionalWrap';
import { useExportRoutingTree } from '../useExportRoutingTree';
import { isRouteProvisioned, useDeleteRoutingTree } from '../useNotificationPolicyRoute';

import { DeleteModal, ResetModal } from './Modals';

interface ActionButtonsProps {
  route: Route;
}

export const ActionButtons = ({ route }: ActionButtonsProps) => {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const [
    [updatePoliciesSupported, updatePoliciesAllowed],
    [deletePoliciesSupported, deletePoliciesAllowed],
    [exportPoliciesSupported, exportPoliciesAllowed],
  ] = useAlertmanagerAbilities([
    AlertmanagerAction.UpdateNotificationPolicyTree,
    AlertmanagerAction.DeleteNotificationPolicy,
    AlertmanagerAction.ExportNotificationPolicies,
  ]);

  const [ExportDrawer, showExportDrawer] = useExportRoutingTree();
  const [deleteTrigger] = useDeleteRoutingTree();

  const provisioned = isRouteProvisioned(route);
  const canEdit = updatePoliciesSupported && updatePoliciesAllowed && !provisioned;

  const actions: JSX.Element[] = [];
  actions.push(
    <LinkButton
      key="view-routing-tree"
      href={createRelativeUrl(`/alerting/routes/policy/${encodeURIComponent(route.name ?? '')}/edit`)}
      variant="secondary"
      size="sm"
      icon={canEdit ? 'pen' : 'eye'}
      data-testid={`${canEdit ? 'edit' : 'view'}-action`}
    >
      {canEdit ? (
        <Trans i18nKey="alerting.common.edit">Edit</Trans>
      ) : (
        <Trans i18nKey="alerting.common.view">View</Trans>
      )}
    </LinkButton>
  );

  if (exportPoliciesSupported) {
    actions.push(
      <LinkButton
        key="export-routing-tree"
        icon="download-alt"
        variant="secondary"
        size="sm"
        data-testid="export-action"
        disabled={!exportPoliciesAllowed}
        onClick={() => showExportDrawer(route.name ?? '')}
      >
        <Trans i18nKey="alerting.common.export">Export</Trans>
      </LinkButton>
    );
  }

  if (deletePoliciesSupported) {
    const canBeDeleted = deletePoliciesAllowed && !provisioned;
    const isDefaultPolicy = route.name === ROOT_ROUTE_NAME;

    const cannotDeleteNoPermissions = isDefaultPolicy
      ? t(
          'alerting.policies-list.reset-reasons.no-permissions',
          'You do not have the required permission to reset this notification policy'
        )
      : t(
          'alerting.policies-list.delete-reasons.no-permissions',
          'You do not have the required permission to delete this notification policy'
        );
    const cannotDeleteProvisioned = isDefaultPolicy
      ? t(
          'alerting.policies-list.reset-reasons.provisioned',
          'Notification policy is provisioned and cannot be reset via the UI'
        )
      : t(
          'alerting.policies-list.delete-reasons.provisioned',
          'Notification policy is provisioned and cannot be deleted via the UI'
        );
    const cannotDeleteText = isDefaultPolicy
      ? t('alerting.policies-list.reset-text', 'Notification policy cannot be reset for the following reasons:')
      : t('alerting.policies-list.delete-text', 'Notification policy cannot be deleted for the following reasons:');

    const reasonsDeleteIsDisabled = [
      !deletePoliciesAllowed ? cannotDeleteNoPermissions : '',
      provisioned ? cannotDeleteProvisioned : '',
    ].filter(Boolean);

    const deleteTooltipContent = (
      <>
        {cannotDeleteText}
        <br />
        {reasonsDeleteIsDisabled.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </>
    );

    actions.push(
      <ConditionalWrap
        key="delete-routing-tree"
        shouldWrap={!canBeDeleted}
        wrap={(children) => (
          <Tooltip content={deleteTooltipContent} placement="top">
            <span>{children}</span>
          </Tooltip>
        )}
      >
        {route.name === ROOT_ROUTE_NAME ? (
          <LinkButton
            icon="trash-alt"
            variant="secondary"
            size="sm"
            disabled={!canBeDeleted}
            data-testid="reset-action"
            onClick={() => setIsResetModalOpen(true)}
          >
            <Trans i18nKey="alerting.routing-tree-header.reset">Reset</Trans>
          </LinkButton>
        ) : (
          <LinkButton
            icon="trash-alt"
            variant="secondary"
            size="sm"
            disabled={!canBeDeleted}
            data-testid="delete-action"
            onClick={() => setIsDeleteModalOpen(true)}
          >
            <Trans i18nKey="alerting.common.delete">Delete</Trans>
          </LinkButton>
        )}
      </ConditionalWrap>
    );
  }

  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="flex-end" wrap="wrap">
        {actions}
      </Stack>
      <DeleteModal
        isOpen={isDeleteModalOpen}
        onConfirm={() =>
          deleteTrigger.execute({
            name: route[ROUTES_META_SYMBOL]?.name ?? '',
            resourceVersion: route[ROUTES_META_SYMBOL]?.resourceVersion,
          })
        }
        onDismiss={() => setIsDeleteModalOpen(false)}
        routeName={route[ROUTES_META_SYMBOL]?.name ?? ''}
      />
      <ResetModal
        isOpen={isResetModalOpen}
        onConfirm={() =>
          deleteTrigger.execute({
            name: route[ROUTES_META_SYMBOL]?.name ?? '',
            resourceVersion: route[ROUTES_META_SYMBOL]?.resourceVersion,
          })
        }
        onDismiss={() => setIsResetModalOpen(false)}
        routeName={route[ROUTES_META_SYMBOL]?.name ?? ''}
      />
      {ExportDrawer}
    </>
  );
};
