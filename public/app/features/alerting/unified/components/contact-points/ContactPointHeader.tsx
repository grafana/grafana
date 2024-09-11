import { css } from '@emotion/css';
import { Fragment } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Dropdown, LinkButton, Menu, Stack, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import ConditionalWrap from 'app/features/alerting/unified/components/ConditionalWrap';
import { useExportContactPoint } from 'app/features/alerting/unified/components/contact-points/useExportContactPoint';
import { PROVENANCE_ANNOTATION } from 'app/features/alerting/unified/utils/k8s/constants';

import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { createRelativeUrl } from '../../utils/url';
import MoreButton from '../MoreButton';
import { ProvisioningBadge } from '../Provisioning';
import { Spacer } from '../Spacer';

import { UnusedContactPointBadge } from './components/UnusedBadge';
import { ContactPointWithMetadata } from './utils';

interface ContactPointHeaderProps {
  contactPoint: ContactPointWithMetadata;
  disabled?: boolean;
  onDelete: (contactPoint: ContactPointWithMetadata) => void;
}

export const ContactPointHeader = ({ contactPoint, disabled = false, onDelete }: ContactPointHeaderProps) => {
  const { name, id, provisioned, policies = [] } = contactPoint;
  const styles = useStyles2(getStyles);

  const [exportSupported, exportAllowed] = useAlertmanagerAbility(AlertmanagerAction.ExportContactPoint);
  const [editSupported, editAllowed] = useAlertmanagerAbility(AlertmanagerAction.UpdateContactPoint);
  const [deleteSupported, deleteAllowed] = useAlertmanagerAbility(AlertmanagerAction.UpdateContactPoint);

  const [ExportDrawer, openExportDrawer] = useExportContactPoint();

  const numberOfPolicies = policies.length;
  const isReferencedByAnyPolicy = numberOfPolicies > 0;
  const isReferencedByRegularPolicies = policies.some((ref) => ref.route.type !== 'auto-generated');

  const canEdit = editSupported && editAllowed && !provisioned;
  const canDelete = deleteSupported && deleteAllowed && !provisioned && !isReferencedByRegularPolicies;

  const menuActions: JSX.Element[] = [];

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
    menuActions.push(
      <ConditionalWrap
        key="delete-contact-point"
        shouldWrap={!canDelete}
        wrap={(children) => (
          <Tooltip content="Contact point is currently in use by one or more notification policies" placement="top">
            <span>{children}</span>
          </Tooltip>
        )}
      >
        <Menu.Item
          label="Delete"
          ariaLabel="delete"
          icon="trash-alt"
          destructive
          disabled={disabled || !canDelete}
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
        {isReferencedByAnyPolicy && (
          <TextLink
            href={createRelativeUrl('/alerting/routes', { contactPoint: name })}
            variant="bodySmall"
            color="primary"
            inline={false}
          >
            {referencedByPoliciesText}
          </TextLink>
        )}
        {provisioned && (
          <ProvisioningBadge tooltip provenance={contactPoint.metadata?.annotations?.[PROVENANCE_ANNOTATION]} />
        )}
        {!isReferencedByAnyPolicy && <UnusedContactPointBadge />}
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
