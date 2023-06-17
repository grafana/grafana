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
      <Stack direction="column" gap={1}>
        <ContactPointHeader name={'grafana-default-email'} />
        <div className={styles.receiversWrapper}>
          <ContactPointReceiver
            type={'email'}
            description="gilles.demey@grafana.com"
            error="could not connect"
            sendingResolved={true}
          />
        </div>
      </Stack>
      <Stack direction="column" gap={1}>
        <ContactPointHeader name={'New school'} />
        <div className={styles.receiversWrapper}>
          <Stack direction="column" gap={1}>
            <ContactPointReceiver type={'slack'} description="#test-alerts" sendingResolved={false} />
            <ContactPointReceiver type={'discord'} sendingResolved={true} />
          </Stack>
        </div>
      </Stack>
      <Stack direction="column" gap={1}>
        <ContactPointHeader name={'Japan 🇯🇵'} />
        <div className={styles.receiversWrapper}>
          <ContactPointReceiver type={'line'} sendingResolved={true} />
        </div>
      </Stack>
      <Stack direction="column" gap={1}>
        <ContactPointHeader name={'Google Stuff'} />
        <div className={styles.receiversWrapper}>
          <ContactPointReceiver type={'googlechat'} sendingResolved={true} />
        </div>
      </Stack>
      <Stack direction="column" gap={1}>
        <ContactPointHeader name={'Chinese Contact Points'} />
        <div className={styles.receiversWrapper}>
          <Stack direction="column" gap={1}>
            <ContactPointReceiver type={'dingding'} sendingResolved={true} />
            <ContactPointReceiver type={'wecom'} sendingResolved={true} />
          </Stack>
        </div>
      </Stack>
    </Stack>
  );
};

interface ContactPointHeaderProps {
  name: string;
}

const ContactPointHeader = (props: ContactPointHeaderProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.headerWrapper}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Strong>{props.name}</Strong>
        <MetaText>
          is used by <Strong>2</Strong> notification policies
        </MetaText>
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
  sendingResolved: boolean;
}

const ContactPointReceiver = (props: ContactPointReceiverProps) => {
  const { type, description, error, sendingResolved } = props;
  const styles = useStyles2(getStyles);

  const iconName = INTEGRATION_ICONS[type];

  return (
    <div className={styles.contactPointWrapper}>
      <Stack direction="column" gap={0}>
        <div className={styles.receiverDescriptionRow}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Stack direction="row" alignItems="center" gap={0.5}>
              {iconName && <Icon name={iconName} />}
              <strong>{type}</strong>
            </Stack>
            {description && (
              <Span variant="bodySmall" color="secondary">
                {description}
              </Span>
            )}
            <Spacer />
            {error && <Badge text={'Error'} color={'red'} icon="exclamation-circle" />}
          </Stack>
        </div>
        <div className={styles.metadataRow}>
          <Stack direction="row" gap={1}>
            <MetaText icon="clock-nine">
              Last delivery attempt <Strong>25 minutes ago</Strong>
            </MetaText>
            <MetaText icon="hourglass">
              took <Strong>2s</Strong>
            </MetaText>
            {!sendingResolved && (
              <MetaText icon="exclamation-circle">
                <Strong>Only firing</Strong> notifications
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
    flex: 1;
    position: relative;
    background: ${theme.colors.background.secondary};

    border-radius: ${theme.shape.borderRadius(2)};
    border: solid 1px ${theme.colors.border.weak};
  `,
  headerWrapper: css`
    padding: ${theme.spacing(1)} ${theme.spacing(1.5)};
    border: solid 1px ${theme.colors.border.weak};

    width: max-content;
    border-radius: ${theme.shape.borderRadius(2)};
    background: ${theme.colors.background.secondary};
  `,
  receiverDescriptionRow: css`
    padding: ${theme.spacing(1)} ${theme.spacing(1.5)};
    border-bottom: solid 1px ${theme.colors.border.weak};
  `,
  metadataRow: css`
    background: ${theme.colors.background.primary};
    padding: ${theme.spacing(1.5)};

    border-bottom-left-radius: ${theme.shape.borderRadius(2)};
    border-bottom-right-radius: ${theme.shape.borderRadius(2)};
  `,
  receiversWrapper: css`
    margin-left: ${theme.spacing(3)};
    position: relative;

    &:before {
      content: '';
      position: absolute;
      height: 100%;
      border-left: solid 1px rgba(204, 204, 220, 0.12);
      margin-top: 0;
      margin-left: -20px;
    }
  `,
});

export default ContactPoints;
