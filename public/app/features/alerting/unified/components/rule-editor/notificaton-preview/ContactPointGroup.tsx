import { css } from '@emotion/css';
import { PropsWithChildren, ReactNode } from 'react';
import Skeleton from 'react-loading-skeleton';
import { useToggle } from 'react-use';

import { alertingAPI, getContactPointDescription } from '@grafana/alerting/unstable';
import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { createFieldSelector } from '../../../utils/k8s/utils';
import { createContactPointLink } from '../../../utils/misc';
import { CollapseToggle } from '../../CollapseToggle';
import { MetaText } from '../../MetaText';
import { ContactPointLink } from '../../rule-viewer/ContactPointLink';

import UnknownContactPointDetails from './UnknownContactPointDetails';

interface ContactPointGroupProps extends PropsWithChildren {
  name: string;
  matchedInstancesCount: number;
}

export function GrafanaContactPointGroup({ name, matchedInstancesCount, children }: ContactPointGroupProps) {
  // find receiver by name – since this is what we store in the alert rule definition
  const { data, isLoading } = alertingAPI.endpoints.listReceiver.useQuery({
    fieldSelector: createFieldSelector([['spec.title', name]]),
  });

  // grab the first result from the fieldSelector result
  const contactPoint = data?.items.at(0);

  return (
    <ContactPointGroup
      isLoading={isLoading}
      matchedInstancesCount={matchedInstancesCount}
      name={
        contactPoint ? (
          <ContactPointLink name={name} external color="primary" variant="bodySmall" />
        ) : (
          <UnknownContactPointDetails receiverName={name ?? 'unknown'} />
        )
      }
      description={contactPoint ? getContactPointDescription(contactPoint) : null}
    >
      {children}
    </ContactPointGroup>
  );
}

export function ExternalContactPointGroup({
  name,
  alertmanagerSourceName,
  children,
}: ContactPointGroupProps & { alertmanagerSourceName: string }) {
  const link = (
    <TextLink color="primary" external inline={false} href={createContactPointLink(name, alertmanagerSourceName)}>
      {name}
    </TextLink>
  );
  return <ContactPointGroup name={link}>{children}</ContactPointGroup>;
}

interface ContactPointGroupInnerProps extends ContactPointGroupProps {
  name: ReactNode;
  description?: ReactNode;
  isLoading?: boolean;
  children: ReactNode;
}

export function ContactPointGroup({
  name,
  description,
  matchedInstancesCount,
  isLoading = false,
  children,
}: ContactPointGroupInnerProps) {
  const styles = useStyles2(getStyles);
  const [isExpanded, toggleExpanded] = useToggle(false);

  return (
    <Stack direction="column">
      <div className={styles.contactPointRow}>
        <Stack direction="row" alignItems="center">
          <CollapseToggle
            isCollapsed={!isExpanded}
            onToggle={() => toggleExpanded()}
            aria-label={t('alerting.notification-route-header.aria-label-expand-policy-route', 'Expand policy route')}
          />
          {isLoading && loader}
          {!isLoading && (
            <>
              {matchedInstancesCount && (
                <MetaText icon="layers-alt">
                  {/* @TODO pluralization */}
                  {matchedInstancesCount}{' '}
                  <Trans i18nKey="alerting.notification-route-header.instances">instances</Trans>
                </MetaText>
              )}
              {name && (
                <>
                  <MetaText icon="at">
                    <Trans i18nKey="alerting.notification-route-header.delivered-to">Delivered to</Trans> {name}
                  </MetaText>
                  {description && (
                    <Text variant="bodySmall" color="secondary">
                      ⋅ {description}
                    </Text>
                  )}
                </>
              )}
            </>
          )}
        </Stack>
      </div>
      {isExpanded && <div className={styles.notificationPolicies}>{children}</div>}
    </Stack>
  );
}

const loader = (
  <Stack direction="row" gap={1}>
    <Skeleton height={16} width={128} />
    <Skeleton height={16} width={64} />
  </Stack>
);

const getStyles = (theme: GrafanaTheme2) => ({
  contactPointRow: css({
    padding: theme.spacing(0.5),

    ':hover': {
      background: theme.components.table.rowHoverBackground,
    },
  }),
  notificationPolicies: css({
    marginLeft: theme.spacing(2),
    borderLeftStyle: 'solid',
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border.weak,
  }),
});
