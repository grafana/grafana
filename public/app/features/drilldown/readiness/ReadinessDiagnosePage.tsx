import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Alert,
  Badge,
  type BadgeColor,
  Button,
  Combobox,
  Field,
  LoadingPlaceholder,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { AttributeDrawer } from '../otelfirst/AttributeDrawer';
import { getFallbackNavModel } from '../realdata/RealDrilldownPage';

import { FixNamespaceDrawer } from './FixNamespaceDrawer';
import { type Check, type CheckStatus, type ServiceList, loadServiceList, runChecks } from './loadReadiness';

type ListState = { kind: 'loading' } | { kind: 'ready'; list: ServiceList } | { kind: 'error'; message: string };
type ChecksState = { kind: 'loading' } | { kind: 'ready'; checks: Check[] } | { kind: 'error'; message: string };

const NEEDS_CHANGE: CheckStatus[] = ['fail', 'check'];

// Readiness wireframe 2: run the checks support runs by hand for one service and name the first failing one.
interface ViewProps {
  // The service to start on. Without it the first service with a gap is picked.
  initialService?: string;
  // Shown as a button when the view sits under another screen.
  onBack?: () => void;
}

export function ReadinessDiagnosePage() {
  const hasNav = useNavModel('drilldown').node.id !== 'not-found';
  return (
    <Page navId={hasNav ? 'drilldown' : undefined} navModel={hasNav ? undefined : getFallbackNavModel()}>
      <Page.Contents>
        <DiagnoseView />
      </Page.Contents>
    </Page>
  );
}

export function DiagnoseView({ initialService, onBack }: ViewProps) {
  const styles = useStyles2(getStyles);
  const [listState, setListState] = useState<ListState>({ kind: 'loading' });
  const [name, setName] = useState<string | undefined>(initialService);
  const [checksState, setChecksState] = useState<ChecksState>({ kind: 'loading' });
  const [fix, setFix] = useState<'namespace' | 'mapping'>();

  useEffect(() => {
    let cancelled = false;
    loadServiceList()
      .then((list) => !cancelled && setListState({ kind: 'ready', list }))
      .catch((error: Error) => !cancelled && setListState({ kind: 'error', message: error.message }));
    return () => {
      cancelled = true;
    };
  }, []);

  const list = listState.kind === 'ready' ? listState.list : undefined;
  // A service with a gap comes first, so it is the default pick.
  const selected = list?.services.find((service) => service.name === name) ?? list?.services[0];

  const run = useCallback(() => {
    if (!selected) {
      return () => {};
    }
    let cancelled = false;
    setChecksState({ kind: 'loading' });
    runChecks(selected)
      .then((checks) => !cancelled && setChecksState({ kind: 'ready', checks }))
      .catch((error: Error) => !cancelled && setChecksState({ kind: 'error', message: error.message }));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => run(), [run]);

  const statusBadge: Record<CheckStatus, { color: BadgeColor; text: string }> = {
    pass: { color: 'green', text: t('drilldown-readiness.status.pass', 'pass') },
    fail: { color: 'red', text: t('drilldown-readiness.status.fail', 'fail') },
    check: { color: 'orange', text: t('drilldown-readiness.status.check', 'check') },
    'not-run': { color: 'darkgrey', text: t('drilldown-readiness.status.not-run', 'not run') },
    info: { color: 'blue', text: t('drilldown-readiness.status.info', 'info') },
  };

  const needChange =
    checksState.kind === 'ready' ? checksState.checks.filter((c) => NEEDS_CHANGE.includes(c.status)).length : 0;
  const total = checksState.kind === 'ready' ? checksState.checks.length : 0;

  return (
    <>
      {listState.kind === 'loading' && (
        <LoadingPlaceholder text={t('drilldown-readiness.loading', 'Reading the services in each signal')} />
      )}
      {listState.kind === 'error' && (
        <Alert severity="error" title={t('drilldown-readiness.error', 'Could not query the OTel lab data sources')}>
          {listState.message}
        </Alert>
      )}
      {list && selected && (
        <Stack direction="column" gap={3}>
          {onBack && (
            <Button variant="secondary" fill="text" icon="arrow-left" onClick={onBack} className={styles.back}>
              {t('drilldown-readiness.back', 'Back to readiness')}
            </Button>
          )}
          <Text color="secondary">
            {t('drilldown-readiness.intro', 'Run the checks support runs by hand and name the first one that fails.')}
          </Text>
          <Field noMargin label={t('drilldown-readiness.service', 'Service')}>
            <Combobox
              width={32}
              value={selected.name}
              options={list.services.map((service) => ({
                label: service.gap ? `${service.name} (gap)` : service.name,
                value: service.name,
              }))}
              onChange={(option) => setName(option?.value)}
            />
          </Field>

          <Stack justifyContent="space-between" alignItems="center">
            <Stack direction="column" gap={0.25}>
              <Text element="h2" variant="h2">
                {selected.name}
              </Text>
              {checksState.kind === 'ready' && (
                <Text color="secondary">
                  {t('drilldown-readiness.summary', '{{need}} of {{total}} checks need a change', {
                    need: needChange,
                    total,
                  })}
                </Text>
              )}
            </Stack>
            <Button variant="secondary" icon="sync" onClick={run}>
              {t('drilldown-readiness.rerun', 'Run checks again')}
            </Button>
          </Stack>

          {checksState.kind === 'loading' && (
            <LoadingPlaceholder text={t('drilldown-readiness.running', 'Running the checks')} />
          )}
          {checksState.kind === 'error' && (
            <Alert severity="error" title={t('drilldown-readiness.checks-error', 'Could not run the checks')}>
              {checksState.message}
            </Alert>
          )}
          {checksState.kind === 'ready' && (
            <div className={styles.checks}>
              {checksState.checks.map((check) => (
                <div key={check.id} className={styles.check}>
                  <Badge color={statusBadge[check.status].color} text={statusBadge[check.status].text} />
                  <div className={styles.body}>
                    <Text weight="medium">{check.title}</Text>
                    <Text variant="bodySmall" color="secondary">
                      {check.detail} {check.theme}
                    </Text>
                  </div>
                  {check.fix && (
                    <Button size="sm" variant="secondary" onClick={() => setFix(check.fix)}>
                      {t('drilldown-readiness.fix-button', 'Fix')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Stack>
      )}
      {list && selected && fix === 'namespace' && (
        <FixNamespaceDrawer
          service={selected.name}
          namespace={list.commonNamespace}
          onClose={() => setFix(undefined)}
        />
      )}
      {selected && fix === 'mapping' && <AttributeDrawer service={selected.name} onClose={() => setFix(undefined)} />}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  checks: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(1) }),
  check: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(1.5, 2),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  back: css({ alignSelf: 'flex-start' }),
  body: css({ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }),
});

export default ReadinessDiagnosePage;
