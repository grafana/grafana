import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Badge, Button, Icon, useStyles2 } from '@grafana/ui';
import { Span } from '@grafana/ui/src/unstable';
import { GrafanaNotifierType } from 'app/types/alerting';

import { MetaText } from '../MetaText';
import { Spacer } from '../Spacer';
import { Strong } from '../Strong';
// TODO move these icons somewhere else
import { INTEGRATION_ICONS } from '../notification-policies/Policy';

const ContactPoints = () => {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column">
      <div className={styles.contactPointWrapper}>
        <Stack direction="column" gap={0}>
          <ContactPointHeader name={'grafana-default-email'} />
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
}

const ContactPointHeader = (props: ContactPointHeaderProps) => {
  const { name, provenance } = props;

  const styles = useStyles2(getStyles);
  const isProvisioned = Boolean(provenance);

  return (
    <div className={styles.headerWrapper}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Stack alignItems="center" gap={1}>
          <Span variant="body">{name}</Span>
        </Stack>
        <MetaText>
          {/* TODO make this a link to the notification policies page with the filter applied */}
          is used by <Strong>2</Strong> notification policies
        </MetaText>
        <Spacer />
        {isProvisioned && <Badge color="purple" text="Provisioned" />}
        {!isProvisioned && (
          <Button
            variant="secondary"
            size="sm"
            icon="edit"
            type="button"
            aria-label="edit-action"
            data-testid="edit-action"
          >
            Edit
          </Button>
        )}
        {/* additional actions:
          copy name,
          export,
          delete,
        */}
        <Button
          variant="secondary"
          size="sm"
          icon="ellipsis-h"
          type="button"
          aria-label="more-actions"
          data-testid="more-actions"
        />
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
                    <Icon name="exclamation-circle" /> Last delivery attempt failed
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
    flex: 1;
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
  receiversWrapper: css`
    /* margin-left: ${theme.spacing(3)}; */
    /* position: relative; */

    /* &:before {
      content: '';
      position: absolute;
      height: 100%;
      border-left: solid 1px rgba(204, 204, 220, 0.12);
      margin-top: 0;
      margin-left: -${theme.spacing(2)};
    } */
  `,
});

export default ContactPoints;
