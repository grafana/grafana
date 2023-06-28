import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import React from 'react';

import { dateTime, GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Alert, Badge, Button, Dropdown, Icon, LoadingPlaceholder, Menu, Tooltip, useStyles2 } from '@grafana/ui';
import { Span } from '@grafana/ui/src/unstable';
import ConditionalWrap from 'app/features/alerting/components/ConditionalWrap';
import { GrafanaNotifierType, NotifierStatus } from 'app/types/alerting';

import { INTEGRATION_ICONS } from '../../types/contact-points';
import { MetaText } from '../MetaText';
import { Spacer } from '../Spacer';
import { Strong } from '../Strong';

import { RECEIVER_STATUS_KEY, useContactPoints } from './useContactPoints';

const ContactPoints = () => {
  const styles = useStyles2(getStyles);

  // TODO hardcoded for now, change this to allow selecting different alertmanager
  const selectedAlertmanager = 'grafana';
  const { isLoading, error, contactPoints } = useContactPoints(selectedAlertmanager);

  if (error) {
    return <Alert title="Failed to fetch contact points">{String(error)}</Alert>;
  }

  // TODO show loading skeleton?
  if (isLoading) {
    return <LoadingPlaceholder text={'Loading...'} />;
  }

  return (
    <>
      <Stack direction="column">
        {contactPoints.map((contactPoint) => {
          const contactPointKey = selectedAlertmanager + contactPoint.name;
          // for some reason the provenance is on the receiver and not the entire contact point
          const provenance = contactPoint.grafana_managed_receiver_configs.find(
            (receiver) => receiver.provenance
          )?.provenance;

          return (
            <div className={styles.contactPointWrapper} key={contactPointKey}>
              <Stack direction="column" gap={0}>
                <ContactPointHeader name={contactPoint.name} policies={[]} provenance={provenance} />
                <div className={styles.receiversWrapper}>
                  {contactPoint.grafana_managed_receiver_configs?.map((receiver) => {
                    const diagnostics = receiver[RECEIVER_STATUS_KEY];
                    const sendingResolved = !Boolean(receiver.disableResolveMessage);

                    return (
                      <ContactPointReceiver
                        key={uniqueId()}
                        type={receiver.type}
                        // TODO we can figure something out to extract a "description" from each receiver type
                        description="gilles.demey@grafana.com"
                        diagnostics={diagnostics}
                        sendingResolved={sendingResolved}
                      />
                    );
                  })}
                </div>
              </Stack>
            </div>
          );
        })}
      </Stack>
    </>
  );
};

interface ContactPointHeaderProps {
  name: string;
  provenance?: string;
  policies?: string[]; // some array of policies that refer to this contact point
}

const ContactPointHeader = (props: ContactPointHeaderProps) => {
  const { name, provenance, policies = [] } = props;

  const styles = useStyles2(getStyles);
  const isProvisioned = Boolean(provenance);

  return (
    <div className={styles.headerWrapper}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Stack alignItems="center" gap={1}>
          <Span variant="body">{name}</Span>
        </Stack>
        {policies.length > 0 ? (
          <MetaText>
            {/* TODO make this a link to the notification policies page with the filter applied */}
            is used by <Strong>{policies.length}</Strong> notification policies
          </MetaText>
        ) : (
          <MetaText>is not used</MetaText>
        )}
        {isProvisioned && <Badge color="purple" text="Provisioned" />}
        <Spacer />
        <ConditionalWrap
          shouldWrap={isProvisioned}
          wrap={(children) => (
            <Tooltip content="Provisioned items cannot be edited in the UI" placement="top">
              {children}
            </Tooltip>
          )}
        >
          <Button
            variant="secondary"
            size="sm"
            icon="edit"
            type="button"
            disabled={isProvisioned}
            aria-label="edit-action"
            data-testid="edit-action"
          >
            Edit
          </Button>
        </ConditionalWrap>
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item label="Export" icon="download-alt" />
              <Menu.Divider />
              <Menu.Item label="Delete" icon="trash-alt" destructive disabled={isProvisioned} />
            </Menu>
          }
        >
          <Button
            variant="secondary"
            size="sm"
            icon="ellipsis-h"
            type="button"
            aria-label="more-actions"
            data-testid="more-actions"
          />
        </Dropdown>
      </Stack>
    </div>
  );
};

interface ContactPointReceiverProps {
  type: GrafanaNotifierType | string;
  description?: string;
  sendingResolved?: boolean;
  diagnostics?: NotifierStatus;
}

const ContactPointReceiver = (props: ContactPointReceiverProps) => {
  const { type, description, diagnostics, sendingResolved = true } = props;
  const styles = useStyles2(getStyles);

  const iconName = INTEGRATION_ICONS[type];
  const hasMetadata = diagnostics !== undefined;

  return (
    <div className={styles.integrationWrapper}>
      <Stack direction="column" gap={0}>
        <div className={styles.receiverDescriptionRow}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Stack direction="row" alignItems="center" gap={0.5}>
              {iconName && <Icon name={iconName} />}
              <Span variant="body" color="primary">
                {type}
              </Span>
            </Stack>
            {description && (
              <Span variant="bodySmall" color="secondary">
                {description}
              </Span>
            )}
          </Stack>
        </div>
        {hasMetadata && <ContactPointReceiverMetadataRow diagnostics={diagnostics} sendingResolved={sendingResolved} />}
      </Stack>
    </div>
  );
};

interface ContactPointReceiverMetadata {
  sendingResolved: boolean;
  diagnostics: NotifierStatus;
}

const ContactPointReceiverMetadataRow = (props: ContactPointReceiverMetadata) => {
  const { diagnostics, sendingResolved } = props;
  const styles = useStyles2(getStyles);

  const failedToSend = Boolean(diagnostics.lastNotifyAttemptError);
  const lastDeliveryAttempt = dateTime(diagnostics.lastNotifyAttempt);
  const lastDeliveryAttemptDuration = diagnostics.lastNotifyAttemptDuration;

  return (
    <div className={styles.metadataRow}>
      <Stack direction="row" gap={1}>
        {failedToSend ? (
          <>
            {/* TODO we might need an error variant for MetaText, dito for success */}
            <Span color="error" variant="bodySmall" weight="bold">
              <Stack direction="row" alignItems={'center'} gap={0.5}>
                <Tooltip content={diagnostics.lastNotifyAttemptError!}>
                  <span>
                    <Icon name="exclamation-circle" /> Last delivery attempt failed
                  </span>
                </Tooltip>
              </Stack>
            </Span>
          </>
        ) : (
          <>
            {lastDeliveryAttempt.isValid() ? (
              <>
                <MetaText icon="clock-nine">
                  Last delivery attempt{' '}
                  <Tooltip content={lastDeliveryAttempt.toLocaleString()}>
                    <span>
                      <Strong>{lastDeliveryAttempt.locale('en').fromNow()}</Strong>
                    </span>
                  </Tooltip>
                </MetaText>
                <MetaText icon="stopwatch">
                  took <Strong>{lastDeliveryAttemptDuration}</Strong>
                </MetaText>
              </>
            ) : (
              <MetaText icon="clock-nine">No delivery attempt yet</MetaText>
            )}
          </>
        )}
        {!sendingResolved && (
          <MetaText icon="info-circle">
            Delivering <Strong>only firing</Strong> notifications
          </MetaText>
        )}
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  contactPointWrapper: css`
    border-radius: ${theme.shape.borderRadius()};
    border: solid 1px ${theme.colors.border.weak};
    border-bottom: none;
  `,
  integrationWrapper: css`
    position: relative;
    background: ${theme.colors.background.primary};

    border-bottom: solid 1px ${theme.colors.border.weak};
  `,
  headerWrapper: css`
    padding: ${theme.spacing(1)} ${theme.spacing(1.5)};

    background: ${theme.colors.background.secondary};

    border-bottom: solid 1px ${theme.colors.border.weak};
    border-top-left-radius: ${theme.shape.borderRadius()};
    border-top-right-radius: ${theme.shape.borderRadius()};
  `,
  receiverDescriptionRow: css`
    padding: ${theme.spacing(1)} ${theme.spacing(1.5)};
  `,
  metadataRow: css`
    padding: 0 ${theme.spacing(1.5)} ${theme.spacing(1.5)} ${theme.spacing(1.5)};

    border-bottom-left-radius: ${theme.shape.borderRadius()};
    border-bottom-right-radius: ${theme.shape.borderRadius()};
  `,
  receiversWrapper: css``,
});

export default ContactPoints;
