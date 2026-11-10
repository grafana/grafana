import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Button, ClipboardButton, Drawer, RadioButtonGroup, Stack, Text, useStyles2 } from '@grafana/ui';

interface Props {
  service: string;
  namespace: string;
  onClose: () => void;
}

type Remedy = 'sdk' | 'collector' | 'promote';

// The remedy ladder runs from the narrowest change to the widest. Only the last option changes the whole organization.
export function FixNamespaceDrawer({ service, namespace, onClose }: Props) {
  const styles = useStyles2(getStyles);
  const [remedy, setRemedy] = useState<Remedy>('sdk');
  const value = namespace || 'my-namespace';
  const sdk = `OTEL_RESOURCE_ATTRIBUTES=service.namespace=${value}`;
  const collector = [
    'processors:',
    '  resource:',
    '    attributes:',
    '      - key: service.namespace',
    `        value: ${value}`,
    '        action: upsert',
  ].join('\n');

  return (
    <Drawer
      title={t('drilldown-readiness.fix.title', 'Set service.namespace')}
      subtitle={t(
        'drilldown-readiness.fix.subtitle',
        'Choose where to set it for {{service}}. The first option changes only this service.',
        {
          service,
        }
      )}
      onClose={onClose}
      size="md"
    >
      <Stack direction="column" gap={2}>
        <RadioButtonGroup
          value={remedy}
          onChange={setRemedy}
          options={[
            { label: t('drilldown-readiness.fix.sdk', 'In the SDK'), value: 'sdk' },
            { label: t('drilldown-readiness.fix.collector', 'In the collector'), value: 'collector' },
            { label: t('drilldown-readiness.fix.promote', 'Promote at ingestion'), value: 'promote' },
          ]}
        />

        {remedy === 'sdk' && (
          <>
            <Text>{t('drilldown-readiness.fix.sdk-intro', "Add to the service's environment")}</Text>
            <pre className={styles.code}>{sdk}</pre>
            <ClipboardButton getText={() => sdk} variant="secondary" size="sm" icon="copy">
              {t('drilldown-readiness.fix.copy', 'Copy')}
            </ClipboardButton>
            <Text color="secondary">
              {t(
                'drilldown-readiness.fix.sdk-note',
                'Applies after the service restarts. New telemetry carries the namespace. Existing data keeps its old labels.'
              )}
            </Text>
          </>
        )}

        {remedy === 'collector' && (
          <>
            <Text>
              {t('drilldown-readiness.fix.collector-intro', 'Add a resource processor to the collector pipeline')}
            </Text>
            <pre className={styles.code}>{collector}</pre>
            <ClipboardButton getText={() => collector} variant="secondary" size="sm" icon="copy">
              {t('drilldown-readiness.fix.copy', 'Copy')}
            </ClipboardButton>
            <Text color="secondary">
              {t(
                'drilldown-readiness.fix.collector-note',
                'Applies to everything the collector forwards, so add the processor to the pipelines for this service only.'
              )}
            </Text>
          </>
        )}

        {remedy === 'promote' && (
          <>
            <Alert severity="warning" title={t('drilldown-readiness.fix.confirm-title', 'Promote at ingestion')}>
              {t(
                'drilldown-readiness.fix.confirm-body',
                'This changes indexing for the whole organization. Existing queries keep working. New volume can raise cardinality and cost. Needs an admin.'
              )}
            </Alert>
            <Button variant="primary" disabled>
              {t('drilldown-readiness.fix.promote-button', 'Promote')}
            </Button>
            <Text color="secondary">
              {t(
                'drilldown-readiness.fix.promote-note',
                'This prototype shows the step and does not change the backend.'
              )}
            </Text>
          </>
        )}

        <Text color="secondary">
          {t('drilldown-readiness.fix.recheck', 'After the change, run the checks again from the Diagnose view.')}
        </Text>
      </Stack>
    </Drawer>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  code: css({
    margin: 0,
    padding: theme.spacing(1.5),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  }),
});
