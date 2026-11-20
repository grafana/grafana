import { useCallback, useEffect, useRef, useState } from 'react';

import { type NavModel, type TimeRange, type TimeZone, rangeUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Box, Spinner, Stack, Text } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { renderDrilldownTitle } from '../DataSourcesButton';

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
import { EnvironmentSelect } from './components/EnvironmentSelect';
import { NotMeasuredNotice } from './components/NotMeasuredNotice';
import { type AppKey, type Hint, HINTS, NOTES, type Scope, setScopeData } from './liveScenario';
import { loadScope } from './loadScenario';
import { NO_SCOPE_QUERY, hintIdFromQuery, scopeFromQuery, scopeQuery } from './scopeUrl';

const DEFAULT_TIME_RANGE = { from: 'now-30m', to: 'now' };
const APP_KEYS: AppKey[] = ['metrics', 'logs', 'traces', 'profiles', 'sql'];

// The page starts proactive: hints first, then Grafana Assistant works out what is wrong, then the scoped insights.
// The hint the user investigated stays with the insights; a scope picked by hand has none. Every scope is queried
// from the chosen data sources first, so a loading phase sits between picking and showing it. The URL names the scope
// and the hint, and the phase follows it, so Back and Forward move between the overview and a scope.
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
  const [queryParams, updateQueryParams] = useQueryParams();
  const urlScope = scopeFromQuery(queryParams);
  const urlHintId = hintIdFromQuery(queryParams);
  const [phase, setPhase] = useState<Phase>(() =>
    urlScope ? { kind: 'loading', scope: urlScope } : { kind: 'hints' }
  );
  const [loadError, setLoadError] = useState<string>();
  // Bumped after each load so panels that copy the data when they mount are rebuilt.
  const [dataVersion, setDataVersion] = useState(0);

  // The phase follows the scope in the URL. Adjusting it while rendering, and not in an effect, keeps the old phase
  // from being drawn for one pass after Back or Forward.
  const scopeKey = urlScope ? `${urlScope.type}:${urlScope.value}` : '';
  const [phaseScopeKey, setPhaseScopeKey] = useState(scopeKey);
  if (phaseScopeKey !== scopeKey) {
    setPhaseScopeKey(scopeKey);
    if (urlScope) {
      setLoadError(undefined);
      setPhase({ kind: 'loading', scope: urlScope });
    } else {
      setPhase({ kind: 'hints' });
    }
  }

  // The panels read the scope data from module state, so only the newest load may write it. A slow answer for a scope
  // the user has already left would otherwise replace the data of the scope on show.
  const latestLoad = useRef(0);
  const fetchScope = useCallback(async (scope: Scope, range: TimeRange): Promise<boolean> => {
    const load = ++latestLoad.current;
    const current = rangeUtil.convertRawToRange(range.raw);
    const data = await loadScope(
      scope,
      Math.floor(current.from.valueOf() / 1000),
      Math.floor(current.to.valueOf() / 1000)
    );
    if (load !== latestLoad.current) {
      return false;
    }
    setScopeData(data);
    setDataVersion((version) => version + 1);
    return true;
  }, []);

  // Set by Investigate, so the detection step plays for that click and not when the browser replays the URL.
  const detectOnLoad = useRef(false);
  const timeRangeRef = useRef(timeRange);
  useEffect(() => {
    timeRangeRef.current = timeRange;
  }, [timeRange]);

  const scopeType = urlScope?.type;
  const scopeValue = urlScope?.value;
  useEffect(() => {
    const detect = detectOnLoad.current;
    detectOnLoad.current = false;
    if (!scopeType || !scopeValue) {
      return;
    }
    const scope: Scope = { type: scopeType, value: scopeValue };
    let cancelled = false;
    fetchScope(scope, timeRangeRef.current)
      .then((applied) => {
        if (!applied || cancelled) {
          return;
        }
        const hint = HINTS.find(
          (candidate) =>
            candidate.id === urlHintId && candidate.scope.type === scope.type && candidate.scope.value === scope.value
        );
        setPhase(hint && detect ? { kind: 'detecting', hint } : { kind: 'insights', scope, hint });
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setLoadError(error.message);
          // A scope that did not load leaves the URL, so a reload or the same Investigate starts clean.
          updateQueryParams(NO_SCOPE_QUERY, true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [scopeType, scopeValue, urlHintId, fetchScope, updateQueryParams]);

  const openScope = (scope: Scope, hint?: Hint) => {
    detectOnLoad.current = Boolean(hint);
    updateQueryParams(scopeQuery(scope, hint));
  };

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
    <Page
      navId={hasNav ? 'drilldown' : undefined}
      navModel={hasNav ? undefined : getFallbackNavModel()}
      renderTitle={renderDrilldownTitle}
      // The environment filter and what could not be measured sit in the header, so they take no room from the page.
      actions={
        phase.kind === 'hints' ? (
          <Stack alignItems="flex-start" gap={1}>
            <EnvironmentSelect />
            <NotMeasuredNotice notes={NOTES} />
          </Stack>
        ) : undefined
      }
    >
      <Page.Contents>
        {loadError && (
          <Box paddingBottom={2}>
            <Alert severity="error" title={t('drilldown-real.load-error', 'Could not query the selected data sources')}>
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
            onReset={() => updateQueryParams(NO_SCOPE_QUERY)}
          />
        )}
        {/* On the entry page the input follows the detected hints, and the detection step has none. Once
            Grafana Assistant has found a likely cause, its action button replaces the input, so only a
            scope picked by hand keeps it here. */}
        {phase.kind === 'insights' && !phase.hint && <DrilldownAskRow scope={phase.scope} />}
        {phase.kind === 'hints' && (
          <>
            <DrilldownHints onInvestigate={(hint) => openScope(hint.scope, hint)} />
            <DrilldownAskRow />
            {/* Extra space below the input separates asking from browsing. */}
            <Box paddingTop={2}>
              <Stack direction="column" gap={4}>
                <DrilldownSignals appUrls={appUrls} />
                <DrilldownServices onPick={onPickScope} appUrls={appUrls} />
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
