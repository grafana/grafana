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
import { DrilldownEvidence } from './components/DrilldownEvidence';
import { DrilldownHints } from './components/DrilldownHints';
import { DrilldownInsights } from './components/DrilldownInsights';
import { DrilldownLogLabels } from './components/DrilldownLogLabels';
import { DrilldownScopeSummary } from './components/DrilldownScopeSummary';
import { DrilldownServices } from './components/DrilldownServices';
import { DrilldownSignals } from './components/DrilldownSignals';
import { DrilldownTimeControls } from './components/DrilldownTimeControls';
import { NotMeasuredNotice } from './components/NotMeasuredNotice';
import { type AppKey, NOTES, type Scope, setScopeData } from './liveScenario';
import { loadScope } from './loadScenario';
import { NO_SCOPE_QUERY, scopeFromQuery, scopeQuery } from './scopeUrl';

const DEFAULT_TIME_RANGE = { from: 'now-30m', to: 'now' };
const APP_KEYS: AppKey[] = ['metrics', 'logs', 'traces', 'profiles', 'sql'];

type Phase = { kind: 'hints' } | { kind: 'loading'; scope: Scope } | { kind: 'insights'; scope: Scope };

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

  const timeRangeRef = useRef(timeRange);
  useEffect(() => {
    timeRangeRef.current = timeRange;
  }, [timeRange]);

  const scopeType = urlScope?.type;
  const scopeValue = urlScope?.value;
  useEffect(() => {
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
        setPhase({ kind: 'insights', scope });
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
  }, [scopeType, scopeValue, fetchScope, updateQueryParams]);

  const openScope = (scope: Scope) => {
    updateQueryParams(scopeQuery(scope));
  };

  const reloadScope = (scope: Scope, range: TimeRange) => {
    setLoadError(undefined);
    fetchScope(scope, range).catch((error: Error) => setLoadError(error.message));
  };

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
      // What could not be measured sits in the header as an icon, so it takes no room from the page.
      actions={phase.kind === 'hints' ? <NotMeasuredNotice notes={NOTES} /> : undefined}
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
              {t('drilldown-real.loading.telemetry', 'Loading telemetry for {{service}}', {
                service: phase.scope.value,
              })}
            </Text>
            <Spinner inline />
          </Stack>
        )}
        {phase.kind === 'insights' && (
          <DrilldownScopeSummary
            scope={phase.scope}
            detected={false}
            onChangeScope={onPickScope}
            onReset={() => updateQueryParams(NO_SCOPE_QUERY)}
          />
        )}
        {phase.kind === 'insights' && <DrilldownAskRow scope={phase.scope} />}
        {phase.kind === 'hints' && (
          <>
            <DrilldownHints />
            <DrilldownAskRow />
            {/* Extra space below the input separates asking from browsing. */}
            <Box paddingTop={2}>
              <Stack direction="column" gap={4}>
                <DrilldownServices onPick={onPickScope} />
                <DrilldownLogLabels />
                <DrilldownSignals appUrls={appUrls} />
              </Stack>
            </Box>
          </>
        )}
        {phase.kind === 'insights' && (
          <Box>
            <Stack direction="column" gap={3}>
              <DrilldownInsights appUrls={appUrls} />
              {/* The time range only matters once there is evidence to look at. */}
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
