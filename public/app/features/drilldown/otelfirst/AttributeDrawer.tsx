import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Badge, Button, Drawer, LoadingPlaceholder, Modal, Stack, Text, useStyles2 } from '@grafana/ui';

import { type AttributeRow, type LogState, loadAttributeMap } from './loadAttributeMap';

interface Props {
  service: string;
  onClose: () => void;
}

type State = { kind: 'loading' } | { kind: 'ready'; rows: AttributeRow[] } | { kind: 'error'; message: string };

// How one service's resource attributes reach each signal, with the gaps a team can fix.
export function AttributeDrawer({ service, onClose }: Props) {
  const styles = useStyles2(getStyles);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [promote, setPromote] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    loadAttributeMap(service)
      .then((rows) => !cancelled && setState({ kind: 'ready', rows }))
      .catch((error: Error) => !cancelled && setState({ kind: 'error', message: error.message }));
    return () => {
      cancelled = true;
    };
  }, [service]);

  const logLabels: Record<LogState, { color: 'green' | 'blue' | 'orange'; text: string }> = {
    index: { color: 'green', text: t('drilldown-otel.drawer.index', 'index label') },
    metadata: { color: 'blue', text: t('drilldown-otel.drawer.metadata', 'structured metadata') },
    missing: { color: 'orange', text: t('drilldown-otel.drawer.missing', 'not reported') },
  };
  const okLabel = t('drilldown-otel.drawer.ok', 'ok');
  const missingLabel = t('drilldown-otel.drawer.missing', 'not reported');
  const notApplicable = t('drilldown-otel.drawer.na', 'n/a');

  return (
    <Drawer
      title={t('drilldown-otel.drawer.title', 'How this maps to each signal')}
      subtitle={t(
        'drilldown-otel.drawer.subtitle',
        'Attribute names follow OpenTelemetry semantic conventions. Each backend spells them its own way.'
      )}
      onClose={onClose}
      size="md"
    >
      {state.kind === 'loading' && (
        <LoadingPlaceholder
          text={t('drilldown-otel.drawer.loading', 'Checking {{service}} in each signal', { service })}
        />
      )}
      {state.kind === 'error' && (
        <Alert severity="error" title={t('drilldown-otel.drawer.error', 'Could not read the attribute mapping')}>
          {state.message}
        </Alert>
      )}
      {state.kind === 'ready' && (
        <Stack direction="column" gap={3}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('drilldown-otel.drawer.attribute', 'Attribute')}</th>
                <th>{t('drilldown-otel.signals.traces', 'Traces')}</th>
                <th>{t('drilldown-otel.signals.metrics', 'Metrics')}</th>
                <th>{t('drilldown-otel.signals.logs', 'Logs')}</th>
                <th>{t('drilldown-otel.signals.profiles', 'Profiles')}</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row) => (
                <tr key={row.otel}>
                  <td>
                    <Text weight="medium">{row.otel}</Text>
                  </td>
                  <td>
                    <Badge
                      color={row.trace.state === 'ok' ? 'green' : 'orange'}
                      text={row.trace.state === 'ok' ? okLabel : missingLabel}
                    />
                    <div className={styles.spelling}>{row.trace.name}</div>
                  </td>
                  <td>
                    <Badge
                      color={row.metric.state === 'ok' ? 'green' : 'orange'}
                      text={row.metric.state === 'ok' ? okLabel : missingLabel}
                    />
                    <div className={styles.spelling}>{row.metric.name}</div>
                  </td>
                  <td>
                    <Badge color={logLabels[row.log.state].color} text={logLabels[row.log.state].text} />
                    <div className={styles.spelling}>{row.log.name}</div>
                  </td>
                  <td>{notApplicable}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {state.rows
            .filter((row) => row.log.state !== 'index')
            .map((row) => (
              <div key={row.otel} className={styles.gap}>
                <Text weight="medium">
                  {t('drilldown-otel.drawer.gap-title', '{{attribute}} in Logs', { attribute: row.otel })}
                </Text>
                {row.log.state === 'metadata' ? (
                  <>
                    <Text color="secondary">
                      {t(
                        'drilldown-otel.drawer.gap-metadata',
                        'Stored as structured metadata. Filters on this attribute need a stream selector until it is promoted to an index label.'
                      )}
                    </Text>
                    <Button size="sm" variant="secondary" onClick={() => setPromote(row.otel)}>
                      {t('drilldown-otel.drawer.promote', 'Promote to index label...')}
                    </Button>
                  </>
                ) : (
                  <Text color="secondary">
                    {t(
                      'drilldown-otel.drawer.gap-missing',
                      'No log line for this service carries the attribute. Set it as a resource attribute in the SDK or the Collector.'
                    )}
                  </Text>
                )}
              </div>
            ))}
        </Stack>
      )}

      <Modal
        isOpen={Boolean(promote)}
        title={t('drilldown-otel.drawer.confirm-title', 'Confirm: promote {{attribute}}', { attribute: promote })}
        onDismiss={() => setPromote(undefined)}
      >
        <Stack direction="column" gap={1}>
          <Text>
            {t(
              'drilldown-otel.drawer.confirm-body',
              'This changes log indexing for the whole organization. Existing queries keep working. New log volume can raise cardinality and cost.'
            )}
          </Text>
          <Text color="secondary">
            {t(
              'drilldown-otel.drawer.confirm-note',
              'This prototype shows the confirmation step and does not change Loki.'
            )}
          </Text>
        </Stack>
        <Modal.ButtonRow>
          <Button variant="secondary" fill="outline" onClick={() => setPromote(undefined)}>
            {t('drilldown-otel.drawer.cancel', 'Cancel')}
          </Button>
          <Button variant="primary" disabled>
            {t('drilldown-otel.drawer.confirm', 'Promote')}
          </Button>
        </Modal.ButtonRow>
      </Modal>
    </Drawer>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    width: '100%',
    borderCollapse: 'collapse',
    'th, td': {
      padding: theme.spacing(1),
      textAlign: 'left',
      verticalAlign: 'top',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },
    th: { color: theme.colors.text.secondary, fontWeight: theme.typography.fontWeightMedium },
  }),
  spelling: css({
    marginTop: theme.spacing(0.5),
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    wordBreak: 'break-all',
  }),
  gap: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1.5, 2),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
});
