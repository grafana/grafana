import { css } from '@emotion/css';
import { groupBy, size, upperFirst } from 'lodash';
import { Fragment, ReactNode } from 'react';

import { GrafanaTheme2, dateTime } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { PrimaryText } from 'app/features/alerting/unified/components/common/TextVariants';
import { ContactPointHeader } from 'app/features/alerting/unified/components/contact-points/ContactPointHeader';
import { useDeleteContactPointModal } from 'app/features/alerting/unified/components/contact-points/components/Modals';
import { useDeleteContactPoint } from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { receiverTypeNames } from 'app/plugins/datasource/alertmanager/consts';
import { GrafanaNotifierType, NotifierStatus } from 'app/types/alerting';

import { INTEGRATION_ICONS } from '../../types/contact-points';
import { MetaText } from '../MetaText';
import { ReceiverMetadataBadge } from '../receivers/grafanaAppReceivers/ReceiverMetadataBadge';
import { ReceiverPluginMetadata } from '../receivers/grafanaAppReceivers/useReceiversMetadata';

import { RECEIVER_META_KEY, RECEIVER_PLUGIN_META_KEY, RECEIVER_STATUS_KEY } from './constants';
import { ContactPointWithMetadata, ReceiverConfigWithMetadata, getReceiverDescription } from './utils';

interface ContactPointProps {
  contactPoint: ContactPointWithMetadata;
}

export const ContactPoint = ({ contactPoint }: ContactPointProps) => {
  const { grafana_managed_receiver_configs: receivers } = contactPoint;
  const styles = useStyles2(getStyles);
  const { selectedAlertmanager } = useAlertmanager();
  const [deleteTrigger] = useDeleteContactPoint({ alertmanager: selectedAlertmanager! });
  const [DeleteModal, showDeleteModal] = useDeleteContactPointModal(deleteTrigger.execute);

  // TODO probably not the best way to figure out if we want to show either only the summary or full metadata for the receivers?
  const showFullMetadata = receivers.some((receiver) => Boolean(receiver[RECEIVER_META_KEY]));

  return (
    <div className={styles.contactPointWrapper} data-testid="contact-point">
      <Stack direction="column" gap={0}>
        <ContactPointHeader
          contactPoint={contactPoint}
          onDelete={(contactPointToDelete) =>
            showDeleteModal({
              name: contactPointToDelete.id || contactPointToDelete.name,
              resourceVersion: contactPointToDelete.metadata?.resourceVersion,
            })
          }
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
      {DeleteModal}
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
  receivers: ReceiverConfigWithMetadata[];
  limit?: number;
};

/**
 * This summary is used when we're dealing with non-Grafana managed alertmanager since they
 * don't have any metadata worth showing other than a summary of what types are configured for the contact point
 */
export const ContactPointReceiverSummary = ({ receivers, limit }: ContactPointReceiverSummaryProps) => {
  // limit for how many integrations are rendered
  const INTEGRATIONS_LIMIT = limit ?? Number.MAX_VALUE;
  const countByType = groupBy(receivers, (receiver) => receiver.type);

  const numberOfUniqueIntegrations = size(countByType);
  const integrationsShown = Object.entries(countByType).slice(0, INTEGRATIONS_LIMIT);
  const numberOfIntegrationsNotShown = numberOfUniqueIntegrations - INTEGRATIONS_LIMIT;

  return (
    <Stack direction="column" gap={0}>
      <Stack direction="row" alignItems="center" gap={1}>
        {integrationsShown.length === 0 && (
          <MetaText color="warning" icon="exclamation-triangle">
            <Trans i18nKey="alerting.contact-points.no-integrations">No integrations configured</Trans>
          </MetaText>
        )}
        {integrationsShown.map(([type, receivers], index) => {
          const iconName = INTEGRATION_ICONS[type];
          const receiverName = receiverTypeNames[type] ?? upperFirst(type);
          const isLastItem = size(countByType) - 1 === index;
          // Pick the first integration of the grouped receivers, since they should all be the same type
          // e.g. if we have multiple Oncall, they _should_ all have the same plugin metadata,
          // so we can just use the first one for additional display purposes
          const receiver = receivers[0];

          return (
            <Fragment key={type}>
              <Stack direction="row" alignItems="center" gap={0.5}>
                {receiver[RECEIVER_PLUGIN_META_KEY]?.icon && (
                  <img
                    width="14px"
                    src={receiver[RECEIVER_PLUGIN_META_KEY]?.icon}
                    alt={receiver[RECEIVER_PLUGIN_META_KEY]?.title}
                  />
                )}
                {iconName && <Icon name={iconName} />}
                <span>
                  {receiverName}
                  {receivers.length > 1 && ` (${receivers.length})`}
                </span>
              </Stack>
              {!isLastItem && '⋅'}
            </Fragment>
          );
        })}
        {numberOfIntegrationsNotShown > 0 && <span>{`+${numberOfIntegrationsNotShown} more`}</span>}
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
          <MetaText color="error" icon="exclamation-circle">
            <Tooltip content={diagnostics.lastNotifyAttemptError!}>
              <span>
                <Trans i18nKey="alerting.contact-points.last-delivery-failed">Last delivery attempt failed</Trans>
              </span>
            </Tooltip>
          </MetaText>
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
    borderRadius: theme.shape.radius.default,
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
  noIntegrationsContainer: css({
    paddingTop: `${theme.spacing(1.5)}`,
    paddingLeft: `${theme.spacing(1.5)}`,
  }),
});
