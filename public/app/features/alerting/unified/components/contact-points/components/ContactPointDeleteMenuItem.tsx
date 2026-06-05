import { Trans, t } from '@grafana/i18n';
import { Menu, Tooltip } from '@grafana/ui';
import ConditionalWrap from 'app/features/alerting/unified/components/ConditionalWrap';
import { type ContactPointWithMetadata } from 'app/features/alerting/unified/components/contact-points/utils';

export interface ContactPointDeleteMenuItemProps {
  contactPoint: ContactPointWithMetadata;
  onDelete: (contactPoint: ContactPointWithMetadata) => void;
  canBeDeleted: boolean;
  hasAbilityToDelete: boolean;
  isProvisioned: boolean;
  numberOfPoliciesPreventingDeletion: number;
  numberOfRules: number;
}

export function ContactPointDeleteMenuItem({
  contactPoint,
  onDelete,
  canBeDeleted,
  hasAbilityToDelete,
  isProvisioned,
  numberOfPoliciesPreventingDeletion,
  numberOfRules,
}: ContactPointDeleteMenuItemProps) {
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

  return (
    <ConditionalWrap
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
