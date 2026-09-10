import { isErrorSpan } from '../../TraceTimelineViewer/utils';
import { type TraceSpan } from '../../types/trace';

export type TraceBannerSeverity = 'error' | 'warning';

export type TraceBannerHighlight = {
  span: TraceSpan;
  severity: TraceBannerSeverity;
};

const HTTP_STATUS_KEYS = ['http.response.status_code', 'http.status_code'];
const HTTP_METHOD_KEYS = ['http.request.method', 'http.method'];
const HTTP_PATH_KEYS = ['http.route', 'http.target', 'http.path', 'http.url'];

function getTagValue(span: TraceSpan, keys: string[]): string | undefined {
  for (const key of keys) {
    const match = span.tags.find((tag) => tag.key === key);
    if (match != null && match.value != null && match.value !== '') {
      return String(match.value);
    }
  }
  return undefined;
}

function getSpanBannerSeverity(span: TraceSpan): TraceBannerSeverity | undefined {
  const statusClass = getTagValue(span, HTTP_STATUS_KEYS)?.charAt(0);
  if (isErrorSpan(span) || statusClass === '5') {
    return 'error';
  }
  if (statusClass === '4') {
    return 'warning';
  }
  return undefined;
}

function isBetterBannerSpan(candidate: TraceSpan, current: TraceSpan): boolean {
  if (candidate.depth !== current.depth) {
    return candidate.depth > current.depth;
  }
  if (candidate.duration !== current.duration) {
    return candidate.duration > current.duration;
  }
  return candidate.startTime < current.startTime;
}

export function findTraceBanner(spans: TraceSpan[]): TraceBannerHighlight | undefined {
  let error: TraceSpan | undefined;
  let warning: TraceSpan | undefined;

  for (const span of spans) {
    const severity = getSpanBannerSeverity(span);
    if (severity === 'error' && (!error || isBetterBannerSpan(span, error))) {
      error = span;
    } else if (severity === 'warning' && (!warning || isBetterBannerSpan(span, warning))) {
      warning = span;
    }
  }

  if (error) {
    return { span: error, severity: 'error' };
  }
  if (warning) {
    return { span: warning, severity: 'warning' };
  }
  return undefined;
}

export function getTraceBannerOperationLabel(span: TraceSpan): string {
  const method = getTagValue(span, HTTP_METHOD_KEYS);
  const rawPath = getTagValue(span, HTTP_PATH_KEYS);
  let path = rawPath;

  if (rawPath?.includes('://')) {
    try {
      path = new URL(rawPath).pathname;
    } catch {
      path = rawPath;
    }
  }

  return [method, path ?? span.operationName].filter(Boolean).join(' ');
}

export function getSpanTracePercent(spanDuration: number, traceDuration: number): number {
  if (traceDuration <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((spanDuration / traceDuration) * 1000) / 10);
}
