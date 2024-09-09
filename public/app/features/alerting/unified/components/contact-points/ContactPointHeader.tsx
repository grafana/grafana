import { css } from '@emotion/css';
import { Fragment, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Dropdown, LinkButton, Menu, Stack, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import ConditionalWrap from 'app/features/alerting/unified/components/ConditionalWrap';
import { useExportContactPoint } from 'app/features/alerting/unified/components/contact-points/useExportContactPoint';
import { ManagePermissionsDrawer } from 'app/features/alerting/unified/components/permissions/ManagePermissions';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { PROVENANCE_ANNOTATION } from 'app/features/alerting/unified/utils/k8s/constants';

import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { createRelativeUrl } from '../../utils/url';
import MoreButton from '../MoreButton';
import { ProvisioningBadge } from '../Provisioning';
import { Spacer } from '../Spacer';

import { UnusedContactPointBadge } from './components/UnusedBadge';
import {
  canDeleteContactPoint,
  canEditContactPoint,
  canAdminContactPoint,
  ContactPointWithMetadata,
  showManageContactPointPermissions,
} from './utils';

interface ContactPointHeaderProps {
  contactPoint: ContactPointWithMetadata;
  disabled?: boolean;
  onDelete: (contactPoint: ContactPointWithMetadata) => void;
  showPolicies?: boolean;
}

export const ContactPointHeader = ({
  contactPoint,
  disabled = false,
  onDelete,
  showPolicies = true,
}: ContactPointHeaderProps) => {
  const { name, id, provisioned, policies = [] } = contactPoint;
  const styles = useStyles2(getStyles);
  const [showPermissionsDrawer, setShowPermissionsDrawer] = useState(false);
  const { selectedAlertmanager } = useAlertmanager();

  const [exportSupported, exportAllowed] = useAlertmanagerAbility(AlertmanagerAction.ExportContactPoint);
  const [editSupported, editAllowed] = useAlertmanagerAbility(AlertmanagerAction.UpdateContactPoint);
  const [deleteSupported, deleteAllowed] = useAlertmanagerAbility(AlertmanagerAction.UpdateContactPoint);

  const [ExportDrawer, openExportDrawer] = useExportContactPoint();

  const showManagePermissions =
    canAdminContactPoint(contactPoint) && showManageContactPointPermissions(selectedAlertmanager!, contactPoint);

  const numberOfPolicies = Number(contactPoint.metadata?.annotations?.['grafana.com/inUse/routes'] ?? policies.length);

  const numberOfRules = (contactPoint.metadata?.annotations?.['grafana.com/inUse/rules'] || '')
    .split(',')
    .filter(Boolean).length;

  /** Is the contact point referenced by anything such as notification policies or as a simplified routing contact point? */
  const isReferencedByAnythingElse = numberOfRules + numberOfPolicies > 0;
  const isReferencedByRegularPolicies =
    numberOfPolicies > 0 ?? policies.some((ref) => ref.route.type !== 'auto-generated');

  /** Does the current user have permissions to edit the contact point? */
  const hasAbilityToEdit = canEditContactPoint(contactPoint) || editAllowed;
  /** Can the contact point be edited via the UI? */
  const contactPointIsEditable = !provisioned;
  /** Given the alertmanager, the user's permissions, and the state of the contact point - can it actually be edited? */
  const canEdit = editSupported && hasAbilityToEdit && contactPointIsEditable;

  /** Does the current user have permissions to delete the contact point? */
  const hasAbilityToDelete = canDeleteContactPoint(contactPoint) || deleteAllowed;
  /** Can the contact point actually be deleted, regardless of permissions? i.e. ensuring it isn't provisioned and isn't referenced elsewhere */
  const contactPointIsDeleteable = !provisioned && !isReferencedByRegularPolicies;
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
    const reasonsDeleteIsDisabled = [
      !hasAbilityToDelete ? 'You do not have permission to delete this contact point' : '',
      provisioned ? 'Contact point is provisioned and cannot be deleted via the UI' : '',
      isReferencedByRegularPolicies ? 'Contact point is referenced by one or more notification policies' : '',
    ].filter(Boolean);

    const deleteTooltipContent = (
      <>
        <div>Contact point cannot be deleted for the following reasons:</div>
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
          disabled={disabled || !canBeDeleted}
          onClick={() => onDelete(contactPoint)}
        />
      </ConditionalWrap>
    );
  }

  const referencedByPoliciesText = t('alerting.contact-points.used-by', 'Used by {{ count }} notification policy', {
    count: numberOfPolicies,
  });

  // TOOD: Tidy up/consolidate logic for working out id for contact point. This requires some unravelling of
  // existing types so its clearer where the ID has come from
  const urlId = id || name;

  return (
    <div className={styles.headerWrapper}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Stack alignItems="center" gap={1}>
          <Text element="h2" variant="body" weight="medium">
            {name}
          </Text>
        </Stack>
        {numberOfPolicies > 0 && showPolicies && (
          <TextLink
            href={createRelativeUrl('/alerting/routes', { contactPoint: name })}
            variant="bodySmall"
            color="primary"
            inline={false}
          >
            {referencedByPoliciesText}
          </TextLink>
        )}
        {numberOfRules > 0 && showPolicies && (
          <TextLink
            href={createRelativeUrl('/alerting/list', { search: `contactPoint:"${name}"` })}
            variant="bodySmall"
            color="primary"
            inline={false}
          >
            Used by {numberOfRules} alert rules
          </TextLink>
        )}
        {provisioned && (
          <ProvisioningBadge tooltip provenance={contactPoint.metadata?.annotations?.[PROVENANCE_ANNOTATION]} />
        )}
        {!isReferencedByAnythingElse && showPolicies && <UnusedContactPointBadge />}
        <Spacer />
        <LinkButton
          tooltipPlacement="top"
          tooltip={provisioned ? 'Provisioned contact points cannot be edited in the UI' : undefined}
          variant="secondary"
          size="sm"
          icon={canEdit ? 'pen' : 'eye'}
          type="button"
          disabled={disabled}
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
