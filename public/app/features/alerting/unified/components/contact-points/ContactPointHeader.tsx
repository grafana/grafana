import { css } from '@emotion/css';
import { Fragment, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Dropdown, LinkButton, Menu, Stack, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import ConditionalWrap from 'app/features/alerting/unified/components/ConditionalWrap';
import { useExportContactPoint } from 'app/features/alerting/unified/components/contact-points/useExportContactPoint';
import { ManagePermissionsDrawer } from 'app/features/alerting/unified/components/permissions/ManagePermissions';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { K8sAnnotations } from 'app/features/alerting/unified/utils/k8s/constants';
import {
  canDeleteEntity,
  canEditEntity,
  getAnnotation,
  shouldUseK8sApi,
} from 'app/features/alerting/unified/utils/k8s/utils';

import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { createRelativeUrl } from '../../utils/url';
import MoreButton from '../MoreButton';
import { ProvisioningBadge } from '../Provisioning';
import { Spacer } from '../Spacer';

import { UnusedContactPointBadge } from './components/UnusedBadge';
import { ContactPointWithMetadata, showManageContactPointPermissions } from './utils';

interface ContactPointHeaderProps {
  contactPoint: ContactPointWithMetadata;
  onDelete: (contactPoint: ContactPointWithMetadata) => void;
}

export const ContactPointHeader = ({ contactPoint, onDelete }: ContactPointHeaderProps) => {
  const { name, id, provisioned, policies = [] } = contactPoint;
  const styles = useStyles2(getStyles);
  const [showPermissionsDrawer, setShowPermissionsDrawer] = useState(false);
  const { selectedAlertmanager } = useAlertmanager();

  const usingK8sApi = shouldUseK8sApi(selectedAlertmanager!);

  const [exportSupported, exportAllowed] = useAlertmanagerAbility(AlertmanagerAction.ExportContactPoint);
  const [editSupported, editAllowed] = useAlertmanagerAbility(AlertmanagerAction.UpdateContactPoint);
  const [deleteSupported, deleteAllowed] = useAlertmanagerAbility(AlertmanagerAction.UpdateContactPoint);
  const [ExportDrawer, openExportDrawer] = useExportContactPoint();

  const showManagePermissions = showManageContactPointPermissions(selectedAlertmanager!, contactPoint);

  const regularPolicyReferences = policies.filter((ref) => ref.route.type !== 'auto-generated');

  const k8sRoutesInUse = getAnnotation(contactPoint, K8sAnnotations.InUseRoutes);
  /**
   * Number of policies that reference this contact point
   *
   * When the k8s API is being used, this number will only be the regular policies
   * (will not include the auto generated simplified routing policies in the count)
   */
  const numberOfPolicies = usingK8sApi ? Number(k8sRoutesInUse) : policies.length;

  const numberOfPoliciesPreventingDeletion = usingK8sApi ? Number(k8sRoutesInUse) : regularPolicyReferences.length;

  /** Number of rules that use this contact point for simplified routing */
  const numberOfRules = Number(getAnnotation(contactPoint, K8sAnnotations.InUseRules)) || 0;

  /**
   * Is the contact point referenced by anything such as notification policies or as a simplified routing contact point?
   *
   * Used to determine whether to show the "Unused" badge
   */
  const isReferencedByAnything = usingK8sApi ? Boolean(numberOfPolicies || numberOfRules) : policies.length > 0;

  /** Does the current user have permissions to edit the contact point? */
  const hasAbilityToEdit = canEditEntity(contactPoint) || editAllowed;
  /** Can the contact point actually be edited via the UI? */
  const contactPointIsEditable = !provisioned;
  /** Given the alertmanager, the user's permissions, and the state of the contact point - can it actually be edited? */
  const canEdit = editSupported && hasAbilityToEdit && contactPointIsEditable;

  /** Does the current user have permissions to delete the contact point? */
  const hasAbilityToDelete = canDeleteEntity(contactPoint) || deleteAllowed;
  /** Can the contact point actually be deleted, regardless of permissions? i.e. ensuring it isn't provisioned and isn't referenced elsewhere */
  const contactPointIsDeleteable = !provisioned && !numberOfPoliciesPreventingDeletion && !numberOfRules;
  /** Given the alertmanager, the user's permissions, and the state of the contact point - can it actually be deleted? */
  const canBeDeleted = deleteSupported && hasAbilityToDelete && contactPointIsDeleteable;

  const menuActions: JSX.Element[] = [];
  if (showManagePermissions) {
    menuActions.push(
      <Fragment key="manage-permissions">
        <Menu.Item icon="unlock" label="Manage permissions" onClick={() => setShowPermissionsDrawer(true)} />
      </Fragment>
    );
  }

  if (exportSupported) {
    menuActions.push(
      <Fragment key="export-contact-point">
        <Menu.Item
          icon="download-alt"
          label="Export"
          ariaLabel="export"
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
      provisioned ? cannotDeleteProvisioned : '',
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
          label="Delete"
          ariaLabel="delete"
          icon="trash-alt"
          destructive
          disabled={!canBeDeleted}
          onClick={() => onDelete(contactPoint)}
        />
      </ConditionalWrap>
    );
  }

  const referencedByPoliciesText = t('alerting.contact-points.used-by', 'Used by {{ count }} notification policy', {
    count: numberOfPolicies,
  });

  const referencedByRulesText = t('alerting.contact-points.used-by-rules', 'Used by {{ count }} alert rule', {
    count: numberOfRules,
  });

  // TOOD: Tidy up/consolidate logic for working out id for contact point. This requires some unravelling of
  // existing types so its clearer where the ID has come from
  const urlId = id || name;

  return (
    <div className={styles.headerWrapper}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Stack alignItems="center" gap={1} minWidth={0}>
          <Text element="h2" variant="body" weight="medium" truncate>
            {name}
          </Text>
        </Stack>
        {numberOfPolicies > 0 && (
          <TextLink
            href={createRelativeUrl('/alerting/routes', { contactPoint: name })}
            variant="bodySmall"
            color="primary"
            inline={false}
          >
            {referencedByPoliciesText}
          </TextLink>
        )}
        {numberOfRules > 0 && (
          <TextLink
            href={createRelativeUrl('/alerting/list', { search: `contactPoint:"${name}"` })}
            variant="bodySmall"
            color="primary"
            inline={false}
          >
            {referencedByRulesText}
          </TextLink>
        )}
        {provisioned && (
          <ProvisioningBadge tooltip provenance={getAnnotation(contactPoint, K8sAnnotations.Provenance)} />
        )}
        {!isReferencedByAnything && <UnusedContactPointBadge />}
        <Spacer />
        <LinkButton
          tooltipPlacement="top"
          tooltip={provisioned ? 'Provisioned contact points cannot be edited in the UI' : undefined}
          variant="secondary"
          size="sm"
          icon={canEdit ? 'pen' : 'eye'}
          type="button"
          aria-label={`${canEdit ? 'edit' : 'view'}-action`}
          data-testid={`${canEdit ? 'edit' : 'view'}-action`}
          href={`/alerting/notifications/receivers/${encodeURIComponent(urlId)}/edit`}
        >
          {canEdit ? 'Edit' : 'View'}
        </LinkButton>
        {menuActions.length > 0 && (
          <Dropdown overlay={<Menu>{menuActions}</Menu>}>
            <MoreButton aria-label={`More actions for contact point "${contactPoint.name}"`} />
          </Dropdown>
        )}
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
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  headerWrapper: css({
    background: `${theme.colors.background.secondary}`,
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,

    borderBottom: `solid 1px ${theme.colors.border.weak}`,
    borderTopLeftRadius: `${theme.shape.radius.default}`,
    borderTopRightRadius: `${theme.shape.radius.default}`,
  }),
});
