import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Alert,
  Badge,
  Button,
  Icon,
  InlineField,
  InlineSwitch,
  LinkButton,
  LoadingPlaceholder,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { getAppUrls, scopedAppUrl } from '../otelfirst/appUrls';
import { getFallbackNavModel } from '../realdata/RealDrilldownPage';

import { DiagnoseView } from './ReadinessDiagnosePage';
import { type ReadinessService, type ServiceList, isUnnamed, loadServiceList } from './loadReadiness';

type State = { kind: 'loading' } | { kind: 'ready'; list: ServiceList } | { kind: 'error'; message: string };

interface Issue {
  key: string;
  group: string;
  text: string;
  // The service the Diagnose button opens.
  service: string;
}

function getIssues(list: ServiceList): Issue[] {
  const issues: Issue[] = [];
  for (const service of list.services.filter((item) => isUnnamed(item.name))) {
    issues.push({
      key: `identity-${service.name}`,
      group: t('drilldown-readiness.issue.identity', 'Identity'),
      text: t(
        'drilldown-readiness.issue.identity-text',
        '{{service}} has no service name. The SDK default replaced service.name.',
        {
          service: service.name,
        }
      ),
      service: service.name,
    });
  }
  const noNamespace = list.services.filter((service) => service.inMetrics && !service.hasNamespace);
  if (noNamespace.length > 0) {
    issues.push({
      key: 'namespace',
      group: t('drilldown-readiness.issue.namespace', 'Namespace'),
      text: t('drilldown-readiness.issue.namespace-text', '{{services}} send no service.namespace.', {
        services: noNamespace.map((service) => service.name).join(', '),
      }),
      service: noNamespace[0].name,
    });
  }
  const metricsOnly = list.services.filter((service) => service.inMetrics && !service.inLogs);
  if (metricsOnly.length > 0) {
    issues.push({
      key: 'names',
      group: t('drilldown-readiness.issue.names', 'Names across signals'),
      text: t('drilldown-readiness.issue.names-text', '{{services}} have span metrics and no logs under that name.', {
        services: metricsOnly.map((service) => service.name).join(', '),
      }),
      service: metricsOnly[0].name,
    });
  }
  if (!list.logsHaveEnvironment && list.services.length > 0) {
    issues.push({
      key: 'promotion',
      group: t('drilldown-readiness.issue.promotion', 'Promotion'),
      text: t(
        'drilldown-readiness.issue.promotion-text',
        'Logs have no environment label. deployment.environment.name is not indexed.'
      ),
      service: list.services.find((service) => service.inLogs)?.name ?? list.services[0].name,
    });
  }
  return issues;
}

function resultText(service: ReadinessService): string {
  if (!service.gap) {
    return t('drilldown-readiness.result.ready', 'Ready for cross-signal investigation');
  }
  const parts: string[] = [];
  if (isUnnamed(service.name)) {
    parts.push(t('drilldown-readiness.result.unnamed', 'No service name.'));
  }
  if (service.inMetrics && !service.inLogs) {
    parts.push(t('drilldown-readiness.result.no-logs', 'No logs under this name.'));
  }
  if (service.inLogs && !service.inMetrics) {
    parts.push(t('drilldown-readiness.result.no-metrics', 'No span metrics under this name.'));
  }
  if (!service.inTraces) {
    parts.push(t('drilldown-readiness.result.no-traces', 'No traces under this name.'));
  }
  if (!service.hasNamespace && !isUnnamed(service.name)) {
    parts.push(t('drilldown-readiness.result.no-namespace', 'No namespace.'));
  }
  return parts.join(' ');
}

// Readiness wireframe 1: which services can be investigated across signals, and which cannot.
export function ReadinessHomePage() {
  const styles = useStyles2(getStyles);
  const navNode = useNavModel('drilldown').node;
  const hasNav = navNode.id !== 'not-found';
  const appUrls = getAppUrls(navNode.children ?? []);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [diagnosing, setDiagnosing] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    loadServiceList()
      .then((list) => !cancelled && setState({ kind: 'ready', list }))
      .catch((error: Error) => !cancelled && setState({ kind: 'error', message: error.message }));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Page navId={hasNav ? 'drilldown' : undefined} navModel={hasNav ? undefined : getFallbackNavModel()}>
      <Page.Contents>
        {state.kind === 'loading' && (
          <LoadingPlaceholder text={t('drilldown-readiness.loading', 'Reading the services in each signal')} />
        )}
        {state.kind === 'error' && (
          <Alert severity="error" title={t('drilldown-readiness.error', 'Could not query the OTel lab data sources')}>
            {state.message}
          </Alert>
        )}
        {state.kind === 'ready' && diagnosing && (
          <DiagnoseView key={diagnosing} initialService={diagnosing} onBack={() => setDiagnosing(undefined)} />
        )}
        {state.kind === 'ready' && !diagnosing && (
          <Stack direction="column" gap={3}>
            <Text color="secondary">
              {t(
                'drilldown-readiness.home.intro',
                'Check that your services can be investigated across signals, then drill in.'
              )}
            </Text>
            <Strip list={state.list} />
            <Attention list={state.list} onDiagnose={setDiagnosing} />
            <section className={styles.section}>
              <Stack justifyContent="space-between" alignItems="center">
                <Stack direction="column" gap={0.25}>
                  <Text element="h2" variant="h3">
                    {t('drilldown-readiness.services.title', 'Services')}
                  </Text>
                  <Text variant="bodySmall" color="secondary">
                    {t('drilldown-readiness.services.subtitle', 'Services with a gap come first')}
                  </Text>
                </Stack>
                <InlineField label={t('drilldown-readiness.services.only-gaps', 'Show only gaps')}>
                  <InlineSwitch value={onlyGaps} onChange={(event) => setOnlyGaps(event.currentTarget.checked)} />
                </InlineField>
              </Stack>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('drilldown-readiness.services.service', 'Service')}</th>
                      <th>{t('drilldown-readiness.services.traces', 'Traces')}</th>
                      <th>{t('drilldown-readiness.services.metrics', 'Metrics')}</th>
                      <th>{t('drilldown-readiness.services.logs', 'Logs')}</th>
                      <th>{t('drilldown-readiness.services.result', 'Check result')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {state.list.services
                      .filter((service) => !onlyGaps || service.gap)
                      .map((service) => (
                        <tr key={service.name}>
                          <td>
                            <Text weight="medium">{service.name}</Text>
                            {!service.hasNamespace && service.inMetrics && (
                              <div className={styles.note}>
                                {t('drilldown-readiness.services.no-namespace', 'no namespace')}
                              </div>
                            )}
                          </td>
                          <td>
                            <Presence ok={service.inTraces} />
                          </td>
                          <td>
                            <Presence ok={service.inMetrics} />
                          </td>
                          <td>
                            <Presence ok={service.inLogs} />
                          </td>
                          <td>{resultText(service)}</td>
                          <td>
                            {service.gap || !appUrls.traces ? (
                              <Button size="sm" variant="secondary" onClick={() => setDiagnosing(service.name)}>
                                {t('drilldown-readiness.services.diagnose', 'Diagnose')}
                              </Button>
                            ) : (
                              <LinkButton
                                size="sm"
                                variant="primary"
                                fill="outline"
                                href={scopedAppUrl('traces', appUrls.traces, service.name)}
                              >
                                {t('drilldown-readiness.services.open', 'Open')}
                              </LinkButton>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          </Stack>
        )}
      </Page.Contents>
    </Page>
  );
}

function Presence({ ok }: { ok: boolean }) {
  return ok ? (
    <Badge color="green" text={t('drilldown-readiness.services.ok', 'ok')} />
  ) : (
    <Badge color="orange" text={t('drilldown-readiness.services.none', 'none')} />
  );
}

function Strip({ list }: { list: ServiceList }) {
  const styles = useStyles2(getStyles);
  const tiles = [
    {
      key: 'ready',
      name: t('drilldown-readiness.strip.ready', 'Ready'),
      count: list.services.filter((service) => !service.gap).length,
      note: t('drilldown-readiness.strip.ready-note', 'Cross-signal links possible'),
      good: true,
    },
    {
      key: 'metrics-only',
      name: t('drilldown-readiness.strip.metrics-only', 'Metrics only'),
      count: list.services.filter((service) => service.inMetrics && !service.inLogs).length,
      note: t('drilldown-readiness.strip.metrics-only-note', 'No logs under this name'),
      good: false,
    },
    {
      key: 'logs-only',
      name: t('drilldown-readiness.strip.logs-only', 'Logs only'),
      count: list.services.filter((service) => service.inLogs && !service.inMetrics).length,
      note: t('drilldown-readiness.strip.logs-only-note', 'No span metrics under this name'),
      good: false,
    },
    {
      key: 'no-namespace',
      name: t('drilldown-readiness.strip.no-namespace', 'No namespace'),
      count: list.services.filter((service) => service.inMetrics && !service.hasNamespace).length,
      note: t('drilldown-readiness.strip.no-namespace-note', 'Same name can collide'),
      good: false,
    },
  ];
  return (
    <section className={styles.strip} aria-label={t('drilldown-readiness.strip.title', 'Readiness summary')}>
      {tiles.map((tile) => (
        <div key={tile.key} className={styles.tile}>
          <Text weight="medium">{tile.name}</Text>
          <Text variant="h2">{tile.count}</Text>
          <Stack gap={0.5} alignItems="center">
            <Icon
              name={tile.good ? 'check-circle' : 'exclamation-circle'}
              className={tile.good ? styles.ok : styles.warn}
            />
            <Text variant="bodySmall" color="secondary">
              {tile.note}
            </Text>
          </Stack>
        </div>
      ))}
    </section>
  );
}

function Attention({ list, onDiagnose }: { list: ServiceList; onDiagnose: (service: string) => void }) {
  const styles = useStyles2(getStyles);
  const issues = getIssues(list);
  return (
    <section className={styles.section}>
      <Stack direction="column" gap={0.25}>
        <Text element="h2" variant="h3">
          {t('drilldown-readiness.attention.title', 'Needs attention')}
        </Text>
        <Text variant="bodySmall" color="secondary">
          {t('drilldown-readiness.attention.subtitle', 'Issues grouped by what to change')}
        </Text>
      </Stack>
      {issues.length === 0 && (
        <Text color="secondary">{t('drilldown-readiness.attention.none', 'No issues found.')}</Text>
      )}
      {issues.map((issue) => (
        <div key={issue.key} className={styles.issue}>
          <Badge color="orange" text={issue.group} />
          <div className={styles.issueText}>
            <Text>{issue.text}</Text>
          </div>
          <Button size="sm" variant="secondary" onClick={() => onDiagnose(issue.service)}>
            {t('drilldown-readiness.services.diagnose', 'Diagnose')}
          </Button>
        </div>
      ))}
    </section>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  section: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(1.5) }),
  strip: css({ display: 'grid', gap: theme.spacing(2), gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }),
  tile: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1.5, 2),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  issue: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(1.5, 2),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  issueText: css({ flex: 1, minWidth: 0 }),
  tableWrap: css({
    overflowX: 'auto',
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  table: css({
    width: '100%',
    borderCollapse: 'collapse',
    'th, td': {
      padding: theme.spacing(1, 2),
      textAlign: 'left',
      verticalAlign: 'middle',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },
    th: { color: theme.colors.text.secondary, fontWeight: theme.typography.fontWeightMedium },
    'tbody tr:last-child td': { borderBottom: 'none' },
  }),
  note: css({ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }),
  ok: css({ color: theme.colors.success.text }),
  warn: css({ color: theme.colors.warning.text }),
});

export default ReadinessHomePage;
