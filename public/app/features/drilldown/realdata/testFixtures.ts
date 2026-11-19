import { type Overview, type ScopeData } from './liveScenario';

export const emptyOverview: Overview = {
  hints: [],
  topLogLabels: [],
  scopeValues: { service: [], environment: [], namespace: [] },
  trendMax: 1,
  services: [],
  signals: [],
  exampleService: 'cart',
  notes: [],
  entities: [],
};

export const emptyScopeData: ScopeData = {
  detectionSteps: [],
  detectedScope: { namespace: '', since: '30 minutes', likelyCause: '' },
  insights: [],
  deployIndex: -1,
  deployLabel: '',
  requestDuration: [],
  requestRoute: '',
  requestStepMs: 60_000,
  logLines: [],
  trace: { name: '', durationMs: 0, axisTicks: [], summary: '', spans: [], slowThresholdMs: 0 },
  evidenceText: { impact: '', requestCaption: '', where: '', why: '' },
};

// React reports two children with one key through console.error and keeps rendering, so a test has to look for it.
export function sameKeyWarnings(consoleError: jest.SpyInstance): unknown[][] {
  return consoleError.mock.calls.filter(([message]) => String(message).includes('two children with the same key'));
}
