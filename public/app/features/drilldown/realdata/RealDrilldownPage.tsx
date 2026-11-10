import { useCallback, useState } from 'react';

import { type NavModel, type TimeRange, type TimeZone, rangeUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Box, Spinner, Stack, Text } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { AssistantIcon } from './components/AssistantIcon';
import { DrilldownAskRow } from './components/DrilldownAskRow';
import { DrilldownDetection } from './components/DrilldownDetection';
import { DrilldownEvidence } from './components/DrilldownEvidence';
import { DrilldownHints } from './components/DrilldownHints';
import { DrilldownInsights } from './components/DrilldownInsights';
import { DrilldownScopeSummary } from './components/DrilldownScopeSummary';
import { DrilldownServices } from './components/DrilldownServices';
import { DrilldownSignals } from './components/DrilldownSignals';
import { DrilldownTimeControls } from './components/DrilldownTimeControls';
import { type AppKey, type Hint, type Scope, setScopeData } from './liveScenario';
import { loadScope } from './loadScenario';

const DEFAULT_TIME_RANGE = { from: 'now-30m', to: 'now' };
const APP_KEYS: AppKey[] = ['metrics', 'logs', 'traces', 'profiles', 'sql'];

// The page starts proactive: hints first, then Grafana Assistant works out what is wrong, then the scoped insights.
// The hint the user investigated stays with the insights; a scope picked by hand has none. Unlike the prototype,
// every scope is queried from the lab data sources first, so a loading phase sits between picking and showing it.
type Phase =
  | { kind: 'hints' }
  | { kind: 'loading'; scope: Scope }
  | { kind: 'detecting'; hint: Hint }
  | { kind: 'insights'; scope: Scope; hint?: Hint };

export function RealDrilldownPage() {
  const { node } = useNavModel('drilldown');
  const appUrls = getAppUrls(node.children ?? []);
  // Without a Drilldown section in the nav tree, such as a local build with no Drilldown apps, the page names itself.
  const hasNav = node.id !== 'not-found';

  const [timeRange, setTimeRange] = useState<TimeRange>(() => rangeUtil.convertRawToRange(DEFAULT_TIME_RANGE));
  const [timeZone, setTimeZone] = useState<TimeZone>('utc');
  const [refreshInterval, setRefreshInterval] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'hints' });
  const [loadError, setLoadError] = useState<string>();
  // Bumped after each load so panels that copy the data when they mount are rebuilt.
  const [dataVersion, setDataVersion] = useState(0);

  const fetchScope = useCallback(async (scope: Scope, range: TimeRange) => {
    const current = rangeUtil.convertRawToRange(range.raw);
    setScopeData(
      await loadScope(scope, Math.floor(current.from.valueOf() / 1000), Math.floor(current.to.valueOf() / 1000))
    );
    setDataVersion((version) => version + 1);
  }, []);

  const openScope = useCallback(
    (scope: Scope, hint?: Hint) => {
      setLoadError(undefined);
      setPhase({ kind: 'loading', scope });
      fetchScope(scope, timeRange)
        .then(() => setPhase(hint ? { kind: 'detecting', hint } : { kind: 'insights', scope }))
        .catch((error: Error) => {
          setLoadError(error.message);
          setPhase({ kind: 'hints' });
        });
    },
    [fetchScope, timeRange]
  );

  const reloadScope = (scope: Scope, range: TimeRange) => {
    setLoadError(undefined);
    fetchScope(scope, range).catch((error: Error) => setLoadError(error.message));
  };

  const detectingHint = phase.kind === 'detecting' ? phase.hint : undefined;
  const onDetectionDone = useCallback(() => {
    if (detectingHint) {
      setPhase({ kind: 'insights', scope: detectingHint.scope, hint: detectingHint });
    }
  }, [detectingHint]);

  // A scope the user picks is theirs, so Grafana Assistant's hint and likely cause no longer apply.
  const onPickScope = (scope: Scope) => openScope(scope);

  const onChangeTimeRange = (range: TimeRange) => {
    setTimeRange(range);
    if (phase.kind === 'insights') {
      reloadScope(phase.scope, range);
    }
  };

  return (
    <Page navId={hasNav ? 'drilldown' : undefined} navModel={hasNav ? undefined : getFallbackNavModel()}>
      <Page.Contents>
        {loadError && (
          <Box paddingBottom={2}>
            <Alert severity="error" title={t('drilldown-real.load-error', 'Could not query the OTel lab data sources')}>
              {loadError}
            </Alert>
          </Box>
        )}
        {phase.kind === 'loading' && (
          <Stack gap={1} alignItems="center">
            <AssistantIcon />
            <Text weight="medium">
              {t('drilldown-real.loading.title', 'Grafana Assistant is checking {{service}}', {
                service: phase.scope.value,
              })}
            </Text>
            <Spinner inline />
          </Stack>
        )}
        {/* What Grafana Assistant found sits above the input; the ways to start sit below it. The
            Assistant card already restates the hint, so the hint row itself is not repeated here. */}
        {phase.kind === 'detecting' && <DrilldownDetection hint={phase.hint} onDone={onDetectionDone} />}
        {phase.kind === 'insights' && (
          <DrilldownScopeSummary
            scope={phase.scope}
            detected={Boolean(phase.hint)}
            onChangeScope={onPickScope}
            onReset={() => setPhase({ kind: 'hints' })}
          />
        )}
        {/* On the entry page the input follows the detected hints, and the detection step has none. Once
            Grafana Assistant has found a likely cause, its action button replaces the input, so only a
            scope picked by hand keeps it here. */}
        {phase.kind === 'insights' && !phase.hint && <DrilldownAskRow />}
        {phase.kind === 'hints' && (
          <>
            <DrilldownHints onInvestigate={(hint) => openScope(hint.scope, hint)} />
            <DrilldownAskRow />
            {/* Extra space below the input separates asking from browsing. */}
            <Box paddingTop={2}>
              <Stack direction="column" gap={4}>
                <DrilldownServices onPick={onPickScope} />
                <DrilldownSignals appUrls={appUrls} />
              </Stack>
            </Box>
          </>
        )}
        {phase.kind === 'insights' && (
          // Without the input in between, the insights keep the same distance from the scope card.
          <Box paddingTop={phase.hint ? 3 : 0}>
            <Stack direction="column" gap={3}>
              <DrilldownInsights appUrls={appUrls} />
              {/* The time range only matters once there is evidence to look at, so the entry page and the
                detection step leave it out. */}
              <DrilldownEvidence
                key={dataVersion}
                appUrls={appUrls}
                actions={
                  <DrilldownTimeControls
                    timeRange={timeRange}
                    timeZone={timeZone}
                    refreshInterval={refreshInterval}
                    onChangeTimeRange={onChangeTimeRange}
                    onChangeTimeZone={setTimeZone}
                    onChangeRefreshInterval={setRefreshInterval}
                    onRefresh={() => onChangeTimeRange(rangeUtil.convertRawToRange(timeRange.raw))}
                  />
                }
              />
            </Stack>
          </Box>
        )}
      </Page.Contents>
    </Page>
  );
}

export function getFallbackNavModel(): NavModel {
  const node = {
    id: 'drilldown',
    text: t('drilldown-real.title', 'Drilldown'),
    subTitle: t('drilldown-real.subtitle', "Drill down into your data using Grafana's powerful queryless apps"),
    icon: 'drilldown' as const,
    url: '/drilldown',
  };
  return { node, main: node };
}

// The Drilldown nav children are the installed apps; match them by title so links follow each app's real route.
function getAppUrls(children: Array<{ text: string; url?: string }>): Partial<Record<AppKey, string>> {
  const urls: Partial<Record<AppKey, string>> = {};
  for (const child of children) {
    const key = APP_KEYS.find((appKey) => child.text.toLowerCase() === appKey);
    if (key && child.url) {
      urls[key] = child.url;
    }
  }
  return urls;
}

export default RealDrilldownPage;
