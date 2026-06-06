import { css } from '@emotion/css';
import { Fragment, type JSX, useState } from 'react';

import { getContactPointInUse } from '@grafana/alerting/unstable';
import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Dropdown, LinkButton, Menu, Stack, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';
import ConditionalWrap from 'app/features/alerting/unified/components/ConditionalWrap';
import { useExportContactPoint } from 'app/features/alerting/unified/components/contact-points/useExportContactPoint';
import { ManagePermissionsDrawer } from 'app/features/alerting/unified/components/permissions/ManagePermissions';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { isProvisionedResource, shouldUseK8sApi } from 'app/features/alerting/unified/utils/k8s/utils';

import { isGranted, isSupported } from '../../hooks/abilities/abilityUtils';
import { useContactPointAbility } from '../../hooks/abilities/alertmanager/useContactPointAbility';
import { ContactPointAction, isInUse, isInsufficientPermissions } from '../../hooks/abilities/types';
import { createRelativeUrl } from '../../utils/url';
import MoreButton from '../MoreButton';
import { ProvisioningBadge } from '../Provisioning';
import { Spacer } from '../Spacer';

import { UnusedContactPointBadge } from './components/UnusedBadge';
import { type ContactPointWithMetadata, showManageContactPointPermissions } from './utils';

interface ContactPointHeaderProps {
  contactPoint: ContactPointWithMetadata;
  onDelete: (contactPoint: ContactPointWithMetadata) => void;
}

export const ContactPointHeader = ({ contactPoint, onDelete }: ContactPointHeaderProps) => {
  const { name, id, provenance, policies = [], grafana_managed_receiver_configs: integrations } = contactPoint;
  const styles = useStyles2(getStyles);
  const [showPermissionsDrawer, setShowPermissionsDrawer] = useState(false);
  const { selectedAlertmanager } = useAlertmanager();

  const usingK8sApi = shouldUseK8sApi(selectedAlertmanager!);

  const isProvisioned = isProvisionedResource(provenance);

  // Entity-scoped ability checks
  const exportAbility = useContactPointAbility({ action: ContactPointAction.Export, context: contactPoint });
  const editAbility = useContactPointAbility({ action: ContactPointAction.Update, context: contactPoint });
  const deleteAbility = useContactPointAbility({ action: ContactPointAction.Delete, context: contactPoint });
  const [ExportDrawer, openExportDrawer] = useExportContactPoint();

  const showManagePermissions = showManageContactPointPermissions(selectedAlertmanager!, contactPoint);

  const { routes: k8sRoutesInUse, rules: k8sRulesInUse } = getContactPointInUse(contactPoint);

  /**
   * Non-k8s: policies that reference this contact point, excluding auto-generated simplified-routing
   * policies (which are managed by the simplified-routing feature and cannot be edited by the user).
   */
  const regularPolicyReferences = policies.filter((ref) => ref.route.type !== 'auto-generated');

  /**
   * Number of policies that reference this contact point (for display purposes).
   *
   * When the k8s API is being used this is sourced from the InUseRoutes annotation, which
   * only counts regular policies (auto-generated simplified-routing policies are excluded).
   * On the non-k8s path we likewise exclude auto-generated policies.
   */
  const numberOfPolicies = usingK8sApi ? k8sRoutesInUse : regularPolicyReferences.length;

  /** Number of rules that use this contact point for simplified routing */
  const numberOfRules = usingK8sApi ? k8sRulesInUse : 0;

  /**
   * Is the contact point referenced by anything such as notification policies or as a simplified routing contact point?
   *
   * Used to determine whether to show the "Unused" badge
   */
  const isReferencedByAnything = usingK8sApi ? Boolean(numberOfPolicies || numberOfRules) : policies.length > 0;
  /** Can the contact point actually be edited? Ability encapsulates provisioning + k8s annotation + RBAC. */
  const canEdit = isGranted(editAbility);

  /**
   * Can the contact point be deleted?
   * On the k8s path this is fully encapsulated by the ability (RBAC + provisioning + in-use annotations).
   * On the non-k8s path the ability covers RBAC + provisioning, and we additionally enforce the
   * in-use check here using the policy/rule data fetched from the legacy API.
   */
  const canBeDeleted = isGranted(deleteAbility) && (usingK8sApi || (!regularPolicyReferences.length && !numberOfRules));

  // TOOD: Tidy up/consolidate logic for working out id for contact point. This requires some unravelling of
  // existing types so its clearer where the ID has come from

  const urlId = id || name;

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

  if (isSupported(exportAbility)) {
    menuActions.push(
      <Fragment key="export-contact-point">
        <Menu.Item
          icon="download-alt"
          label={t('alerting.contact-point-header.export-label-export', 'Export')}
          ariaLabel={t('alerting.contact-point-header.export-ariaLabel-export', 'Export')}
          disabled={!exportAbility.granted}
          data-testid="export"
          childItems={[<ExportMenuItem key="export-with-modifications" urlId={urlId} />]}
          onClick={() => openExportDrawer(name)}
        />
        <Menu.Divider />
      </Fragment>
    );
  }

  if (isSupported(deleteAbility)) {
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

    const inUseAbility = isInUse(deleteAbility) ? deleteAbility : null;
    // On the k8s path, in-use state is sourced from the ability's blockedBy field.
    // On the non-k8s path, in-use state is derived from the fetched policies/rules arrays.
    const routesBlockDeletion =
      inUseAbility?.blockedBy.includes('routes') || (!usingK8sApi && regularPolicyReferences.length > 0);
    const rulesBlockDeletion = inUseAbility?.blockedBy.includes('rules') || (!usingK8sApi && numberOfRules > 0);
    const reasonsDeleteIsDisabled = [
      isInsufficientPermissions(deleteAbility) ? cannotDeleteNoPermissions : '',
      isProvisioned ? cannotDeleteProvisioned : '',
      routesBlockDeletion ? cannotDeletePolicies : '',
      rulesBlockDeletion ? cannotDeleteRules : '',
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

  const referencedByPoliciesText = t('alerting.contact-points.used-by', '', {
    count: numberOfPolicies,
    defaultValue_one: 'Used by {{count}} notification policies',
    defaultValue_other: 'Used by {{count}} notification policies',
  });

  const referencedByRulesText = t('alerting.contact-points.used-by-rules', '', {
    count: numberOfRules,
    defaultValue_one: 'Used by {{count}} alert rules',
    defaultValue_other: 'Used by {{count}} alert rules',
  });

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
        {isProvisioned && <ProvisioningBadge tooltip provenance={provenance} />}
        {!isReferencedByAnything && <UnusedContactPointBadge />}
        <Spacer />
        {config.featureToggles.alertingNotificationHistoryGlobal && (
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
          >
            {t('alerting.contact-point-header.button-history', 'History')}
          </LinkButton>
        )}
        <LinkButton
          tooltipPlacement="top"
          tooltip={
            isProvisioned
              ? t(
                  'alerting.contact-point-header.tooltip-provisioned-contact-points',
                  'Provisioned contact points cannot be edited in the UI'
                )
              : undefined
          }
          variant="secondary"
          size="sm"
          icon={canEdit ? 'pen' : 'eye'}
          type="button"
          data-testid={`${canEdit ? 'edit' : 'view'}-action`}
          href={`/alerting/notifications/receivers/${encodeURIComponent(urlId)}/edit`}
        >
          {canEdit
            ? t('alerting.contact-point-header.button-edit', 'Edit')
            : t('alerting.contact-point-header.button-view', 'View')}
        </LinkButton>
        {menuActions.length > 0 && (
          <Dropdown overlay={<Menu>{menuActions}</Menu>}>
            <MoreButton
              aria-label={t(
                'alerting.contact-point-header.aria-label-more-actions',
                'More actions for contact point "{{contactPointName}}"',
                { contactPointName: contactPoint.name }
              )}
            />
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

interface ExportMenuItemProps {
  urlId: string;
}

const ExportMenuItem = ({ urlId }: ExportMenuItemProps) => {
  const url = `/alerting/notifications/receivers/${encodeURIComponent(urlId)}/modify-export`;
  return (
    <Menu.Item
      label={t('alerting.alert-menu.with-modifications', 'With modifications')}
      icon="file-edit-alt"
      url={url}
    />
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
