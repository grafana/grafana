import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { ContactPointReceiverMetadataRow } from 'app/features/alerting/unified/components/contact-points/ContactPoint';
import {
  RECEIVER_META_KEY,
  RECEIVER_PLUGIN_META_KEY,
  RECEIVER_STATUS_KEY,
} from 'app/features/alerting/unified/components/contact-points/constants';
import {
  type ContactPointWithMetadata,
  type ReceiverConfigWithMetadata,
  getReceiverRoutingSummaryString,
} from 'app/features/alerting/unified/components/contact-points/utils';
import { ReceiverMetadataBadge } from 'app/features/alerting/unified/components/receivers/grafanaAppReceivers/ReceiverMetadataBadge';
import { type NotifierStatus } from 'app/features/alerting/unified/types/alerting';
import { INTEGRATION_ICONS } from 'app/features/alerting/unified/types/contact-points';

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ContactPointInstanceDrawerIntegrations({ contactPoint }: { contactPoint: ContactPointWithMetadata }) {
  const styles = useStyles2(getStyles);
  const receivers = contactPoint.grafana_managed_receiver_configs;

  if (receivers.length === 0) {
    return null;
  }

  const sectionTitle =
    receivers.length === 1
      ? t('alerting.contact-point-instance-drawer.section-integration', 'Integration')
      : t('alerting.contact-point-instance-drawer.section-integrations', 'Integrations');

  return (
    <Stack direction="column" gap={1.5}>
      <Text element="h2" variant="bodySmall" color="secondary" weight="medium">
        {sectionTitle}
      </Text>
      <div className={styles.integrationsIndent}>
        {receivers.map((receiver, index) => (
          <InstanceDrawerIntegrationPanel
            key={`${receiver[RECEIVER_META_KEY].name}-${index}`}
            receiver={receiver}
            isLast={index === receivers.length - 1}
          />
        ))}
      </div>
    </Stack>
  );
}

function InstanceDrawerIntegrationPanel({
  receiver,
  isLast,
}: {
  receiver: ReceiverConfigWithMetadata;
  isLast: boolean;
}) {
  const styles = useStyles2(getStyles);
  const meta = receiver[RECEIVER_META_KEY];
  const pluginMetadata = receiver[RECEIVER_PLUGIN_META_KEY];
  const diagnostics = receiver[RECEIVER_STATUS_KEY];
  const sendingResolved = !Boolean(receiver.disableResolveMessage);
  const routing = getReceiverRoutingSummaryString(receiver);
  const routingLabel =
    receiver.type === 'email'
      ? t('alerting.contact-point-header.label-addresses', 'Addresses')
      : t('alerting.contact-point-header.label-destination', 'Destination');
  const iconName = INTEGRATION_ICONS[receiver.type];
  return (
    <div className={cx(!isLast && styles.integrationPanelWithSeparator)}>
      <Stack direction="column" gap={1.5}>
        <div className={styles.integrationTitleRow}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            {iconName && (
              <span className={styles.integrationTitleIconWrap}>
                <Icon name={iconName} size="lg" />
              </span>
            )}
            {pluginMetadata ? (
              <ReceiverMetadataBadge metadata={pluginMetadata} />
            ) : (
              <Text variant="h6" weight="medium">
                {t('alerting.contact-point-header.integration-heading', '{{name}} · {{type}}', {
                  name: meta.name,
                  type: receiver.type,
                })}
              </Text>
            )}
          </Stack>
        </div>

        <DetailKV label={t('alerting.contact-point-instance-drawer.label-name', 'Name')} value={meta.name} />
        {meta.description ? (
          <DetailKV
            label={t('alerting.contact-point-header.label-receiver-meta-description', 'Description')}
            value={meta.description}
          />
        ) : null}
        {routing ? <DetailKV label={routingLabel} value={routing} /> : null}

        <NotifierDiagnosticsCollapsible diagnostics={diagnostics} sendingResolved={sendingResolved} />
      </Stack>
    </div>
  );
}

function DetailKV({ label, value }: { label: string; value: string }) {
  const styles = useStyles2(getStyles);
  return (
    <Stack direction="row" gap={2} alignItems="baseline" wrap>
      <span className={styles.detailLabel}>
        <Text variant="bodySmall" color="secondary">
          {label}
        </Text>
      </span>
      <span className={styles.detailValue}>
        <Text variant="bodySmall">{value}</Text>
      </span>
    </Stack>
  );
}

function NotifierDiagnosticsCollapsible({
  diagnostics,
  sendingResolved,
}: {
  diagnostics: NotifierStatus | undefined;
  sendingResolved: boolean;
}) {
  const styles = useStyles2(getStyles);
  const [showJson, setShowJson] = useState(false);

  return (
    <div className={styles.diagnosticsBlock}>
      <Stack direction="column" gap={1}>
        <Text variant="bodySmall" color="secondary" weight="medium">
          {t('alerting.contact-point-header.label-notifier-diagnostics', 'Notifier status (diagnostics)')}
        </Text>
        {diagnostics ? (
          <>
            <ContactPointReceiverMetadataRow diagnostics={diagnostics} sendingResolved={sendingResolved} />
            <Button
              type="button"
              variant="secondary"
              fill="text"
              size="sm"
              icon={showJson ? 'angle-up' : 'angle-down'}
              onClick={() => setShowJson((v) => !v)}
            >
              {showJson
                ? t('alerting.contact-point-instance-drawer.show-less-json', 'Show less')
                : t('alerting.contact-point-instance-drawer.show-more-json', 'Show more')}
            </Button>
            {showJson ? <pre className={styles.jsonPre}>{safeJson(diagnostics)}</pre> : null}
          </>
        ) : (
          <Text variant="bodySmall" color="secondary">
            —
          </Text>
        )}
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const borderWeak = `1px solid ${theme.colors.border.weak}`;

  return {
    integrationsIndent: css({
      paddingLeft: theme.spacing(2),
      borderLeft: borderWeak,
    }),
    integrationPanelWithSeparator: css({
      paddingBottom: theme.spacing(2),
      marginBottom: theme.spacing(2),
      borderBottom: borderWeak,
    }),
    integrationTitleRow: css({
      marginBottom: theme.spacing(1),
    }),
    integrationTitleIconWrap: css({
      display: 'inline-flex',
      flexShrink: 0,
      alignItems: 'center',
    }),
    detailLabel: css({
      flexShrink: 0,
      minWidth: theme.spacing(12),
    }),
    detailValue: css({
      minWidth: 0,
      wordBreak: 'break-word',
    }),
    diagnosticsBlock: css({
      marginTop: theme.spacing(2),
    }),
    jsonPre: css({
      margin: 0,
      maxHeight: 240,
      overflow: 'auto',
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.secondary,
      border: borderWeak,
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }),
  };
};
