// Live replacement for mockScenario.ts. The copied components import the same names, and the page fills these
// bindings from the OTel lab data sources before it renders them.

export type AppKey = 'metrics' | 'logs' | 'traces' | 'profiles' | 'sql';

export type ScopeType = 'service' | 'environment' | 'namespace';

export interface Scope {
  type: ScopeType;
  value: string;
}

export type HintSeverity = 'slow' | 'errors' | 'deploy';

export interface Hint {
  id: string;
  severity: HintSeverity;
  title: string;
  description: string;
  scope: Scope;
  investigable: boolean;
  trendLabel: string;
  trend: number[];
}

export interface ServiceSummary {
  name: string;
  health: 'degraded' | 'healthy';
  p95: string;
  errorRate: string;
  trend: number[];
  lastDeploy: string;
}

export interface SignalCoverage {
  app: AppKey;
  question: string;
  covered: number;
  total: number;
  unit: 'services' | 'databases';
  missing: string[];
  // True when no data source of this signal exists, so there is nothing to count.
  noSource?: boolean;
}

export interface InsightSummary {
  app: AppKey;
  label: string;
  value: string;
  change: string;
  trend: number[];
  // Red for a change worth attention, neutral for a plain statement such as a missing data source.
  tone?: 'bad' | 'neutral';
}

export type LogLevel = 'error' | 'warn' | 'info';

export type SpanColor = 'blue' | 'orange' | 'green' | 'purple';

export type FlameColor = 'blue' | 'orange' | 'purple' | 'red';

export interface TraceSpan {
  service: string;
  operation: string;
  depth: number;
  startMs: number;
  durationMs: number;
  color: SpanColor;
}

export interface TraceView {
  name: string;
  durationMs: number;
  axisTicks: string[];
  summary: string;
  spans: TraceSpan[];
  slowThresholdMs: number;
}

export interface FlameGraphView {
  levels: Array<Array<{ start: number; width: number; color: FlameColor; name: string }>>;
  path: string[];
}

export interface DetectedScope {
  namespace: string;
  since: string;
  likelyCause: string;
}

export interface EvidenceText {
  impact: string;
  requestCaption: string;
  where: string;
  why: string;
}

export interface Overview {
  hints: Hint[];
  scopeValues: Record<ScopeType, string[]>;
  trendMax: number;
  services: ServiceSummary[];
  signals: SignalCoverage[];
  exampleService: string;
}

export interface ScopeData {
  detectionSteps: Array<{ app: AppKey; finding: string }>;
  detectedScope: DetectedScope;
  insights: InsightSummary[];
  deployIndex: number;
  deployLabel: string;
  requestDuration: number[];
  requestRoute: string;
  requestStepMs: number;
  logLines: Array<{ time: string; level: LogLevel; message: string }>;
  trace: TraceView;
  evidenceText: EvidenceText;
}

export let HINTS: Hint[] = [];
export let SCOPE_VALUES: Record<ScopeType, string[]> = { service: [], environment: [], namespace: [] };
export let TREND_MAX = 2;
export let YOUR_SERVICES: ServiceSummary[] = [];
export let SIGNALS: SignalCoverage[] = [];
export let EXAMPLE_SERVICE = 'a service';

export let DETECTION_STEPS: Array<{ app: AppKey; finding: string }> = [];
export let DETECTED_SCOPE: DetectedScope = { namespace: '', since: '', likelyCause: '' };
export let INSIGHTS: InsightSummary[] = [];
// Index of the point where a new service version first appears, or -1 when the range holds no version change.
export let DEPLOY_INDEX = -1;
export let DEPLOY_LABEL = '';
export let REQUEST_DURATION: number[] = [];
export let REQUEST_ROUTE = '';
export let REQUEST_STEP_MS = 60_000;
export let LOG_LINES: Array<{ time: string; level: LogLevel; message: string }> = [];
export let TRACE: TraceView = { name: '', durationMs: 0, axisTicks: [], summary: '', spans: [], slowThresholdMs: 0 };
export let EVIDENCE_TEXT: EvidenceText = { impact: '', requestCaption: '', where: '', why: '' };

// No profiles or SQL data source exists in the lab, so these stay empty and their panels say so.
export const FLAME_GRAPH: FlameGraphView = { levels: [], path: [] };
export const FAILED_ORDERS: Array<{ orderId: string; amount: string; status: string; time: string }> = [];
export const SLOW_QUERIES: Array<{ query: string; p95: string }> = [];

export function setOverview(overview: Overview) {
  HINTS = overview.hints;
  SCOPE_VALUES = overview.scopeValues;
  TREND_MAX = overview.trendMax;
  YOUR_SERVICES = overview.services;
  SIGNALS = overview.signals;
  EXAMPLE_SERVICE = overview.exampleService;
}

export function setScopeData(data: ScopeData) {
  DETECTION_STEPS = data.detectionSteps;
  DETECTED_SCOPE = data.detectedScope;
  INSIGHTS = data.insights;
  DEPLOY_INDEX = data.deployIndex;
  DEPLOY_LABEL = data.deployLabel;
  REQUEST_DURATION = data.requestDuration;
  REQUEST_ROUTE = data.requestRoute;
  REQUEST_STEP_MS = data.requestStepMs;
  LOG_LINES = data.logLines;
  TRACE = data.trace;
  EVIDENCE_TEXT = data.evidenceText;
}
