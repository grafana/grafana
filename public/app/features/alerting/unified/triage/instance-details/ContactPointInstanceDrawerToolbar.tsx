import { Fragment, type JSX, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Dropdown, LinkButton, Menu, Stack, Tooltip } from '@grafana/ui';
import ConditionalWrap from 'app/features/alerting/unified/components/ConditionalWrap';
import MoreButton from 'app/features/alerting/unified/components/MoreButton';
import { ProvisioningBadge } from 'app/features/alerting/unified/components/Provisioning';
import { Spacer } from 'app/features/alerting/unified/components/Spacer';
import { UnusedContactPointBadge } from 'app/features/alerting/unified/components/contact-points/components/UnusedBadge';
import { useExportContactPoint } from 'app/features/alerting/unified/components/contact-points/useExportContactPoint';
import {
  type ContactPointWithMetadata,
  showManageContactPointPermissions,
} from 'app/features/alerting/unified/components/contact-points/utils';
import { ManagePermissionsDrawer } from 'app/features/alerting/unified/components/permissions/ManagePermissions';
import { AlertmanagerAction, useAlertmanagerAbility } from 'app/features/alerting/unified/hooks/useAbilities';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { K8sAnnotations } from 'app/features/alerting/unified/utils/k8s/constants';
import {
  canDeleteEntity,
  canEditEntity,
  getAnnotation,
  isProvisionedResource,
  shouldUseK8sApi,
} from 'app/features/alerting/unified/utils/k8s/utils';
import { createRelativeUrl } from 'app/features/alerting/unified/utils/url';

export interface ContactPointInstanceDrawerToolbarProps {
  contactPoint: ContactPointWithMetadata;
  onDelete: (contactPoint: ContactPointWithMetadata) => void;
}

/**
 * Actions row for the alert instance contact-point drawer (no title — drawer supplies the heading).
 */
export function ContactPointInstanceDrawerToolbar({ contactPoint, onDelete }: ContactPointInstanceDrawerToolbarProps) {
  const { name, id, provenance, policies = [], grafana_managed_receiver_configs: integrations } = contactPoint;
  const [showPermissionsDrawer, setShowPermissionsDrawer] = useState(false);
  const { selectedAlertmanager } = useAlertmanager();
  const usingK8sApi = shouldUseK8sApi(selectedAlertmanager!);
  const isProvisioned = isProvisionedResource(provenance);

  const [exportSupported, exportAllowed] = useAlertmanagerAbility(AlertmanagerAction.ExportContactPoint);
  const [editSupported, editAllowed] = useAlertmanagerAbility(AlertmanagerAction.UpdateContactPoint);
  const [deleteSupported, deleteAllowed] = useAlertmanagerAbility(AlertmanagerAction.UpdateContactPoint);
  const [ExportDrawer, openExportDrawer] = useExportContactPoint();
  const showManagePermissions = showManageContactPointPermissions(selectedAlertmanager!, contactPoint);

  const regularPolicyReferences = policies.filter((ref) => ref.route.type !== 'auto-generated');
  const k8sRoutesInUse = getAnnotation(contactPoint, K8sAnnotations.InUseRoutes);
  const numberOfPolicies = usingK8sApi ? Number(k8sRoutesInUse) : policies.length;
  const numberOfPoliciesPreventingDeletion = usingK8sApi ? Number(k8sRoutesInUse) : regularPolicyReferences.length;
  const numberOfRules = Number(getAnnotation(contactPoint, K8sAnnotations.InUseRules)) || 0;
  const isReferencedByAnything = usingK8sApi ? Boolean(numberOfPolicies || numberOfRules) : policies.length > 0;

  const hasAbilityToEdit = usingK8sApi ? canEditEntity(contactPoint) : editAllowed;
  const contactPointIsEditable = !isProvisioned;
  const canEdit = editSupported && hasAbilityToEdit && contactPointIsEditable;

  const hasAbilityToDelete = usingK8sApi ? canDeleteEntity(contactPoint) : deleteAllowed;
  const contactPointIsDeleteable = !isProvisioned && !numberOfPoliciesPreventingDeletion && !numberOfRules;
  const canBeDeleted = deleteSupported && hasAbilityToDelete && contactPointIsDeleteable;

  const menuActions: JSX.Element[] = [];
  if (showManagePermissions) {
    menuActions.push(
      <Fragment key="manage-permissions">
        <Menu.Item
          icon="unlock"
          label={t('alerting.contact-point-header.label-manage-permissions', 'Manage permissions')}
          onClick={() => setShowPermissionsDrawer(true)}
        />
      </Fragment>
    );
  }

  if (exportSupported) {
    menuActions.push(
      <Fragment key="export-contact-point">
        <Menu.Item
          icon="download-alt"
          label={t('alerting.contact-point-header.export-label-export', 'Export')}
          ariaLabel={t('alerting.contact-point-header.export-ariaLabel-export', 'Export')}
          disabled={!exportAllowed}
          data-testid="export"
          onClick={() => openExportDrawer(name)}
        />
        <Menu.Divider />
      </Fragment>
    );
  }

  if (deleteSupported) {
    const cannotDeleteNoPermissions = t(
      'alerting.contact-points.delete-reasons.no-permissions',
      'You do not have the required permission to delete this contact point'
    );
    const cannotDeleteProvisioned = t(
      'alerting.contact-points.delete-reasons.provisioned',
      'Contact point is provisioned and cannot be deleted via the UI'
    );
    const cannotDeletePolicies = t(
      'alerting.contact-points.delete-reasons.policies',
      'Contact point is referenced by one or more notification policies'
    );
    const cannotDeleteRules = t(
      'alerting.contact-points.delete-reasons.rules',
      'Contact point is referenced by one or more alert rules'
    );

    const reasonsDeleteIsDisabled = [
      !hasAbilityToDelete ? cannotDeleteNoPermissions : '',
      isProvisioned ? cannotDeleteProvisioned : '',
      numberOfPoliciesPreventingDeletion > 0 ? cannotDeletePolicies : '',
      numberOfRules ? cannotDeleteRules : '',
    ].filter(Boolean);

    const deleteTooltipContent = (
      <>
        <Trans i18nKey="alerting.contact-points.delete-reasons.heading">
          Contact point cannot be deleted for the following reasons:
        </Trans>
        <br />
        {reasonsDeleteIsDisabled.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </>
    );

    menuActions.push(
      <ConditionalWrap
        key="delete-contact-point"
        shouldWrap={!canBeDeleted}
        wrap={(children) => (
          <Tooltip content={deleteTooltipContent} placement="top">
            <span>{children}</span>
          </Tooltip>
        )}
      >
        <Menu.Item
          label={t('alerting.contact-point-header.label-delete', 'Delete')}
          ariaLabel={t('alerting.contact-point-header.ariaLabel-delete', 'Delete')}
          icon="trash-alt"
          destructive
          disabled={!canBeDeleted}
          onClick={() => onDelete(contactPoint)}
        />
      </ConditionalWrap>
    );
  }

  const urlId = id || name;

  const openConfigurationButton = (
    <LinkButton
      variant="secondary"
      size="sm"
      icon={canEdit ? 'external-link-alt' : 'eye'}
      type="button"
      data-testid={canEdit ? 'open-configuration-action' : 'view-details-action'}
      href={createRelativeUrl(`/alerting/notifications/receivers/${encodeURIComponent(urlId)}/edit`)}
      target="_blank"
      rel="noopener noreferrer"
      tooltipPlacement="top"
      tooltip={
        isProvisioned
          ? t(
              'alerting.contact-point-header.tooltip-provisioned-contact-points',
              'Provisioned contact points cannot be edited in the UI'
            )
          : undefined
      }
    >
      {canEdit
        ? t('alerting.contact-point-header.button-open-configuration', 'Open configuration')
        : t('alerting.contact-point-header.button-view-details', 'View details')}
    </LinkButton>
  );

  const historyButton = config.featureToggles.alertingNotificationHistoryGlobal && (
    <LinkButton
      variant="secondary"
      size="sm"
      icon="history"
      type="button"
      disabled={integrations.length === 0}
      tooltip={t(
        'alerting.contact-point-header.tooltip-history',
        'View the history of notification attempts made to this contact point'
      )}
      tooltipPlacement="top"
      data-testid="history-action"
      href={createRelativeUrl('/alerting/history', {
        tab: 'notifications',
        'var-RECEIVER_FILTER': name,
      })}
      target="_blank"
      rel="noopener noreferrer"
    >
      {t('alerting.contact-point-header.button-history', 'History')}
    </LinkButton>
  );

  const moreMenu =
    menuActions.length > 0 ? (
      <Dropdown overlay={<Menu>{menuActions}</Menu>}>
        <MoreButton
          aria-label={t(
            'alerting.contact-point-header.aria-label-more-actions',
            'More actions for contact point "{{contactPointName}}"',
            { contactPointName: contactPoint.name }
          )}
        />
      </Dropdown>
    ) : null;

  return (
    <>
      <Stack direction="row" alignItems="center" gap={1} wrap>
        {isProvisioned && <ProvisioningBadge tooltip provenance={provenance} />}
        {!isReferencedByAnything && <UnusedContactPointBadge />}
        <Spacer />
        {historyButton}
        {openConfigurationButton}
        {moreMenu}
      </Stack>
      {ExportDrawer}
      {showPermissionsDrawer && (
        <ManagePermissionsDrawer
          resource="receivers"
          resourceId={contactPoint.id}
          resourceName={contactPoint.name}
          onClose={() => setShowPermissionsDrawer(false)}
        />
      )}
    </>
  );
}
