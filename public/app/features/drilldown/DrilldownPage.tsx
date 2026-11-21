import { useCallback, useState } from 'react';

import { type TimeRange, type TimeZone, rangeUtil } from '@grafana/data';
import { Box, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { DrilldownAskRow } from './components/DrilldownAskRow';
import { DrilldownDetection } from './components/DrilldownDetection';
import { DrilldownEvidence } from './components/DrilldownEvidence';
import { DrilldownHints } from './components/DrilldownHints';
import { DrilldownInsights } from './components/DrilldownInsights';
import { DrilldownScopeSummary } from './components/DrilldownScopeSummary';
import { DrilldownServices } from './components/DrilldownServices';
import { DrilldownSignals } from './components/DrilldownSignals';
import { DrilldownTimeControls } from './components/DrilldownTimeControls';
import { type AppKey, type Hint, type Scope } from './mockScenario';

const DEFAULT_TIME_RANGE = { from: 'now-30m', to: 'now' };
const APP_KEYS: AppKey[] = ['metrics', 'logs', 'traces', 'profiles', 'sql'];

// The page starts proactive: hints first, then Grafana Assistant works out what is wrong, then the scoped insights.
// The hint the user investigated stays with the insights; a scope picked by hand has none.
type Phase = { kind: 'hints' } | { kind: 'detecting'; hint: Hint } | { kind: 'insights'; scope: Scope; hint?: Hint };

export function DrilldownPage() {
  const { node } = useNavModel('drilldown');
  const appUrls = getAppUrls(node.children ?? []);

  const [timeRange, setTimeRange] = useState<TimeRange>(() => rangeUtil.convertRawToRange(DEFAULT_TIME_RANGE));
  const [timeZone, setTimeZone] = useState<TimeZone>('utc');
  const [refreshInterval, setRefreshInterval] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'hints' });

  const detectingHint = phase.kind === 'detecting' ? phase.hint : undefined;
  const onDetectionDone = useCallback(() => {
    if (detectingHint) {
      setPhase({ kind: 'insights', scope: detectingHint.scope, hint: detectingHint });
    }
  }, [detectingHint]);

  // A scope the user picks is theirs, so Grafana Assistant's hint and likely cause no longer apply.
  const onPickScope = (scope: Scope) => setPhase({ kind: 'insights', scope });

  return (
    <Page navId="drilldown">
      <Page.Contents>
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
            <DrilldownHints onInvestigate={(hint) => setPhase({ kind: 'detecting', hint })} />
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
                appUrls={appUrls}
                actions={
                  <DrilldownTimeControls
                    timeRange={timeRange}
                    timeZone={timeZone}
                    refreshInterval={refreshInterval}
                    onChangeTimeRange={setTimeRange}
                    onChangeTimeZone={setTimeZone}
                    onChangeRefreshInterval={setRefreshInterval}
                    onRefresh={() => setTimeRange(rangeUtil.convertRawToRange(timeRange.raw))}
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

export default DrilldownPage;
