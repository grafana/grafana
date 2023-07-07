import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Badge, Button, Dropdown, Icon, Menu, Tooltip, useStyles2 } from '@grafana/ui';
import { Span } from '@grafana/ui/src/unstable';
import ConditionalWrap from 'app/features/alerting/components/ConditionalWrap';
import { GrafanaNotifierType } from 'app/types/alerting';

import { INTEGRATION_ICONS } from '../../types/contact-points';
import { MetaText } from '../MetaText';
import { Spacer } from '../Spacer';
import { Strong } from '../Strong';

const ContactPoints = () => {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column">
      <div className={styles.contactPointWrapper}>
        <Stack direction="column" gap={0}>
          <ContactPointHeader name={'grafana-default-email'} policies={['', '']} />
          <div className={styles.receiversWrapper}>
            <ContactPointReceiver type={'email'} description="gilles.demey@grafana.com" />
          </div>
        </Stack>
      </div>

      <div className={styles.contactPointWrapper}>
        <Stack direction="column" gap={0}>
          <ContactPointHeader name={'New school'} provenance={'api'} />
          <div className={styles.receiversWrapper}>
            <Stack direction="column" gap={0}>
              <ContactPointReceiver type={'slack'} description="#test-alerts" sendingResolved={false} />
              <ContactPointReceiver type={'discord'} />
            </Stack>
          </div>
        </Stack>
      </div>

      <div className={styles.contactPointWrapper}>
        <Stack direction="column" gap={0}>
          <ContactPointHeader name={'Japan 🇯🇵'} />
          <div className={styles.receiversWrapper}>
            <ContactPointReceiver type={'line'} />
          </div>
        </Stack>
      </div>

      <div className={styles.contactPointWrapper}>
        <Stack direction="column" gap={0}>
          <ContactPointHeader name={'Google Stuff'} />
          <div className={styles.receiversWrapper}>
            <ContactPointReceiver type={'googlechat'} />
          </div>
        </Stack>
      </div>

      <div className={styles.contactPointWrapper}>
        <Stack direction="column" gap={0}>
          <ContactPointHeader name={'Chinese Contact Points'} />
          <div className={styles.receiversWrapper}>
            <Stack direction="column" gap={0}>
              <ContactPointReceiver type={'dingding'} />
              <ContactPointReceiver type={'wecom'} error="403 unauthorized" />
            </Stack>
          </div>
        </Stack>
      </div>

      <div className={styles.contactPointWrapper}>
        <Stack direction="column" gap={0}>
          <ContactPointHeader
            name={
              "This is a very long title to check if we are dealing with it appropriately, it shouldn't cause any layout issues"
            }
          />
          <div className={styles.receiversWrapper}>
            <Stack direction="column" gap={0}>
              <ContactPointReceiver type={'dingding'} />
            </Stack>
          </div>
        </Stack>
      </div>
    </Stack>
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
  error?: string;
  sendingResolved?: boolean;
}

const ContactPointReceiver = (props: ContactPointReceiverProps) => {
  const { type, description, error, sendingResolved = true } = props;
  const styles = useStyles2(getStyles);

  const iconName = INTEGRATION_ICONS[type];

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
        <div className={styles.metadataRow}>
          <Stack direction="row" gap={1}>
            {error ? (
              <>
                {/* TODO we might need an error variant for MetaText, dito for success */}
                {/* TODO show error details on hover or elsewhere */}
                <Span color="error" variant="bodySmall" weight="bold">
                  <Stack direction="row" alignItems={'center'} gap={0.5}>
                    <Tooltip
                      content={
                        'failed to send notification to email addresses: gilles.demey@grafana.com: dial tcp 192.168.1.21:1025: connect: connection refused'
                      }
                    >
                      <span>
                        <Icon name="exclamation-circle" /> Last delivery attempt failed
                      </span>
                    </Tooltip>
                  </Stack>
                </Span>
              </>
            ) : (
              <>
                <MetaText icon="clock-nine">
                  Last delivery attempt <Strong>25 minutes ago</Strong>
                </MetaText>
                <MetaText icon="stopwatch">
                  took <Strong>2s</Strong>
                </MetaText>
              </>
            )}
            {!sendingResolved && (
              <MetaText icon="info-circle">
                Delivering <Strong>only firing</Strong> notifications
              </MetaText>
            )}
          </Stack>
        </div>
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
