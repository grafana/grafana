import { Fragment, type JSX, useState } from 'react';

import { t } from '@grafana/i18n';
import { Dropdown, LinkButton, Menu, Stack } from '@grafana/ui';
import MoreButton from 'app/features/alerting/unified/components/MoreButton';
import { ProvisioningBadge } from 'app/features/alerting/unified/components/Provisioning';
import { Spacer } from 'app/features/alerting/unified/components/Spacer';
import { ContactPointDeleteMenuItem } from 'app/features/alerting/unified/components/contact-points/components/ContactPointDeleteMenuItem';
import { ContactPointHistoryLinkButton } from 'app/features/alerting/unified/components/contact-points/components/ContactPointHistoryLinkButton';
import { ContactPointManagePermissionsMenuItem } from 'app/features/alerting/unified/components/contact-points/components/ContactPointManagePermissionsMenuItem';
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
        <ContactPointManagePermissionsMenuItem onOpen={() => setShowPermissionsDrawer(true)} />
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
    menuActions.push(
      <Fragment key="delete-contact-point">
        <ContactPointDeleteMenuItem
          contactPoint={contactPoint}
          onDelete={onDelete}
          canBeDeleted={canBeDeleted}
          hasAbilityToDelete={hasAbilityToDelete}
          isProvisioned={isProvisioned}
          numberOfPoliciesPreventingDeletion={numberOfPoliciesPreventingDeletion}
          numberOfRules={numberOfRules}
        />
      </Fragment>
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
        ? t('alerting.contact-point-header.button-edit', 'Edit')
        : t('alerting.contact-point-header.button-view-details', 'View details')}
    </LinkButton>
  );

  const historyButton = (
    <ContactPointHistoryLinkButton contactPointName={name} integrationsCount={integrations.length} />
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
