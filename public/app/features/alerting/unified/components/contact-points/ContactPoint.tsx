import { css } from '@emotion/css';
import { groupBy, size, upperFirst } from 'lodash';
import { Fragment, ReactNode } from 'react';

import { dateTime, GrafanaTheme2 } from '@grafana/data';
import { Icon, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { PrimaryText } from 'app/features/alerting/unified/components/common/TextVariants';
import { ContactPointHeader } from 'app/features/alerting/unified/components/contact-points/ContactPointHeader';
import { receiverTypeNames } from 'app/plugins/datasource/alertmanager/consts';
import { GrafanaManagedReceiverConfig } from 'app/plugins/datasource/alertmanager/types';
import { GrafanaNotifierType, NotifierStatus } from 'app/types/alerting';

import { INTEGRATION_ICONS } from '../../types/contact-points';
import { MetaText } from '../MetaText';
import { ReceiverMetadataBadge } from '../receivers/grafanaAppReceivers/ReceiverMetadataBadge';
import { ReceiverPluginMetadata } from '../receivers/grafanaAppReceivers/useReceiversMetadata';

import { RECEIVER_META_KEY, RECEIVER_PLUGIN_META_KEY, RECEIVER_STATUS_KEY } from './useContactPoints';
import { getReceiverDescription, ReceiverConfigWithMetadata, RouteReference } from './utils';

interface ContactPointProps {
  name: string;
  disabled?: boolean;
  provisioned?: boolean;
  receivers: ReceiverConfigWithMetadata[];
  policies?: RouteReference[];
  onDelete: (name: string) => void;
}

export const ContactPoint = ({
  name,
  disabled = false,
  provisioned = false,
  receivers,
  policies = [],
  onDelete,
}: ContactPointProps) => {
  const styles = useStyles2(getStyles);

  // TODO probably not the best way to figure out if we want to show either only the summary or full metadata for the receivers?
  const showFullMetadata = receivers.some((receiver) => Boolean(receiver[RECEIVER_STATUS_KEY]));

  return (
    <div className={styles.contactPointWrapper} data-testid="contact-point">
      <Stack direction="column" gap={0}>
        <ContactPointHeader
          name={name}
          policies={policies}
          provisioned={provisioned}
          disabled={disabled}
          onDelete={onDelete}
        />
        {showFullMetadata ? (
          <div>
            {receivers.map((receiver, index) => {
              const diagnostics = receiver[RECEIVER_STATUS_KEY];
              const metadata = receiver[RECEIVER_META_KEY];
              const sendingResolved = !Boolean(receiver.disableResolveMessage);
              const pluginMetadata = receiver[RECEIVER_PLUGIN_META_KEY];
              const key = metadata.name + index;

              return (
                <ContactPointReceiver
                  key={key}
                  name={metadata.name}
                  type={receiver.type}
                  description={getReceiverDescription(receiver)}
                  diagnostics={diagnostics}
                  pluginMetadata={pluginMetadata}
                  sendingResolved={sendingResolved}
                />
              );
            })}
          </div>
        ) : (
          <div className={styles.integrationWrapper}>
            <ContactPointReceiverSummary receivers={receivers} />
          </div>
        )}
      </Stack>
    </div>
  );
};

interface ContactPointReceiverProps {
  name: string;
  type: GrafanaNotifierType | string;
  description?: ReactNode;
  sendingResolved?: boolean;
  diagnostics?: NotifierStatus;
  pluginMetadata?: ReceiverPluginMetadata;
}

const ContactPointReceiver = (props: ContactPointReceiverProps) => {
  const { name, type, description, diagnostics, pluginMetadata, sendingResolved = true } = props;
  const styles = useStyles2(getStyles);

  const hasMetadata = diagnostics !== undefined;

  return (
    <div className={styles.integrationWrapper}>
      <Stack direction="column" gap={0.5}>
        <ContactPointReceiverTitleRow
          name={name}
          type={type}
          description={description}
          pluginMetadata={pluginMetadata}
        />
        {hasMetadata && <ContactPointReceiverMetadataRow diagnostics={diagnostics} sendingResolved={sendingResolved} />}
      </Stack>
    </div>
  );
};

export interface ContactPointReceiverTitleRowProps {
  name: string;
  type: GrafanaNotifierType | string;
  description?: ReactNode;
  pluginMetadata?: ReceiverPluginMetadata;
}

export function ContactPointReceiverTitleRow(props: ContactPointReceiverTitleRowProps) {
  const { name, type, description, pluginMetadata } = props;

  const iconName = INTEGRATION_ICONS[type];

  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <Stack direction="row" alignItems="center" gap={0.5}>
        {iconName && <Icon name={iconName} />}
        {pluginMetadata ? (
          <ReceiverMetadataBadge metadata={pluginMetadata} />
        ) : (
          <Text variant="body" color="primary">
            {name}
          </Text>
        )}
      </Stack>
      {description && (
        <Text variant="bodySmall" color="secondary">
          {description}
        </Text>
      )}
    </Stack>
  );
}

interface ContactPointReceiverMetadata {
  sendingResolved: boolean;
  diagnostics: NotifierStatus;
}

type ContactPointReceiverSummaryProps = {
  receivers: GrafanaManagedReceiverConfig[];
};

/**
 * This summary is used when we're dealing with non-Grafana managed alertmanager since they
 * don't have any metadata worth showing other than a summary of what types are configured for the contact point
 */
export const ContactPointReceiverSummary = ({ receivers }: ContactPointReceiverSummaryProps) => {
  const countByType = groupBy(receivers, (receiver) => receiver.type);

  return (
    <Stack direction="column" gap={0}>
      <Stack direction="row" alignItems="center" gap={1}>
        {Object.entries(countByType).map(([type, receivers], index) => {
          const iconName = INTEGRATION_ICONS[type];
          const receiverName = receiverTypeNames[type] ?? upperFirst(type);
          const isLastItem = size(countByType) - 1 === index;

          return (
            <Fragment key={type}>
              <Stack direction="row" alignItems="center" gap={0.5}>
                {iconName && <Icon name={iconName} />}
                <Text variant="body">
                  {receiverName}
                  {receivers.length > 1 && receivers.length}
                </Text>
              </Stack>
              {!isLastItem && '⋅'}
            </Fragment>
          );
        })}
      </Stack>
    </Stack>
  );
};

const ContactPointReceiverMetadataRow = ({ diagnostics, sendingResolved }: ContactPointReceiverMetadata) => {
  const styles = useStyles2(getStyles);

  const failedToSend = Boolean(diagnostics.lastNotifyAttemptError);
  const lastDeliveryAttempt = dateTime(diagnostics.lastNotifyAttempt);
  const lastDeliveryAttemptDuration = diagnostics.lastNotifyAttemptDuration;
  const hasDeliveryAttempt = lastDeliveryAttempt.isValid();

  return (
    <div className={styles.metadataRow}>
      <Stack direction="row" gap={1}>
        {/* this is shown when the last delivery failed – we don't show any additional metadata */}
        {failedToSend ? (
          <>
            <MetaText color="error" icon="exclamation-circle">
              <Tooltip content={diagnostics.lastNotifyAttemptError!}>
                <span>
                  <Trans i18nKey="alerting.contact-points.last-delivery-failed">Last delivery attempt failed</Trans>
                </span>
              </Tooltip>
            </MetaText>
          </>
        ) : (
          <>
            {/* this is shown when we have a last delivery attempt */}
            {hasDeliveryAttempt && (
              <>
                <MetaText icon="clock-nine">
                  <Trans i18nKey="alerting.contact-points.last-delivery-attempt">Last delivery attempt</Trans>
                  <Tooltip content={lastDeliveryAttempt.toLocaleString()}>
                    <span>
                      <Text color="primary">{lastDeliveryAttempt.locale('en').fromNow()}</Text>
                    </span>
                  </Tooltip>
                </MetaText>
                <MetaText icon="stopwatch">
                  <Trans i18nKey="alerting.contact-points.delivery-duration">
                    Last delivery took <PrimaryText content={lastDeliveryAttemptDuration} />
                  </Trans>
                </MetaText>
              </>
            )}
            {/* when we have no last delivery attempt */}
            {!hasDeliveryAttempt && (
              <MetaText icon="clock-nine">
                <Trans i18nKey="alerting.contact-points.no-delivery-attempts">No delivery attempts</Trans>
              </MetaText>
            )}
            {/* this is only shown for contact points that only want "firing" updates */}
            {!sendingResolved && (
              <MetaText icon="info-circle">
                <Trans i18nKey="alerting.contact-points.only-firing">
                  Delivering <Text color="primary">only firing</Text> notifications
                </Trans>
              </MetaText>
            )}
          </>
        )}
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  contactPointWrapper: css({
    borderRadius: `${theme.shape.radius.default}`,
    border: `solid 1px ${theme.colors.border.weak}`,
    borderBottom: 'none',
  }),
  integrationWrapper: css({
    position: 'relative',

    background: `${theme.colors.background.primary}`,
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,

    borderBottom: `solid 1px ${theme.colors.border.weak}`,
  }),
  metadataRow: css({
    borderBottomLeftRadius: `${theme.shape.radius.default}`,
    borderBottomRightRadius: `${theme.shape.radius.default}`,
  }),
});
