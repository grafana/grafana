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

const ContactPoints = () => (
  <Stack direction="column">
    <Stack direction="column">
      <ContactPointHeader name={'grafana-default-email'} />
      <ContactPointReceiver
        type={'email'}
        description="gilles.demey@grafana.com"
        error="could not connect"
        sendingResolved={true}
      />
    </Stack>
    <Stack direction="column">
      <ContactPointHeader name={'New school'} />
      <Stack direction="column" gap={1}>
        <ContactPointReceiver type={'slack'} description="#test-alerts" sendingResolved={false} />
        <ContactPointReceiver type={'discord'} sendingResolved={true} />
      </Stack>
    </Stack>
    <Stack direction="column">
      <ContactPointHeader name={'🇯🇵 Japan'} />
      <ContactPointReceiver type={'line'} sendingResolved={true} />
    </Stack>
    <Stack direction="column">
      <ContactPointHeader name={'Google Stuff'} />
      <ContactPointReceiver type={'googlechat'} sendingResolved={true} />
    </Stack>
    <Stack direction="column">
      <ContactPointHeader name={'Chinese Contact Points'} />
      <Stack direction="column" gap={1}>
        <ContactPointReceiver type={'dingding'} sendingResolved={true} />
        <ContactPointReceiver type={'wecom'} sendingResolved={true} />
      </Stack>
    </Stack>
  </Stack>
);

interface ContactPointHeaderProps {
  name: string;
}

const ContactPointHeader = (props: ContactPointHeaderProps) => {
  return (
    <Stack direction="row">
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Icon name="at" />
        <Strong>{props.name}</Strong>
      </Stack>
      <Button
        variant="secondary"
        size="sm"
        icon="ellipsis-h"
        type="button"
        aria-label="more-actions"
        data-testid="more-actions"
      />
    </Stack>
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

    margin-left: ${theme.spacing(2)};
  `,
  receiverDescriptionRow: css`
    padding: ${theme.spacing(1.5)};
    border-bottom: solid 1px ${theme.colors.border.weak};
  `,
  metadataRow: css`
    background: ${theme.colors.background.primary};
    padding: ${theme.spacing(1.5)};

    border-bottom-left-radius: ${theme.shape.borderRadius(2)};
    border-bottom-right-radius: ${theme.shape.borderRadius(2)};
  `,
});

export default ContactPoints;
