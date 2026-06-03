import { dateMath } from '@grafana/data';

export function resolveToMs(value: string, roundUp = false): number | null {
  if (!value) {
    return null;
  }
  const parsed = dateMath.parse(value, roundUp);
  if (!parsed) {
    return null;
  }
  return parsed.valueOf();
}

export function timestampAtXNorm(fromMs: number, toMs: number, xNorm: number): number {
  return fromMs + (toMs - fromMs) * xNorm;
}

export function formatHHmm(ms: number): string {
  const d = new Date(ms);
  if (isNaN(d.getTime())) {
    return '';
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function timestampHint(range: { from: string; to: string }, xNorm: number): string {
  const fromMs = resolveToMs(range.from);
  const toMs = resolveToMs(range.to, true);
  if (fromMs === null || toMs === null || toMs <= fromMs) {
    return '';
  }
  return formatHHmm(timestampAtXNorm(fromMs, toMs, xNorm));
}

export function formatRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) {
    return '';
  }
  const diffSec = Math.max(0, Math.round((now.getTime() - then) / 1000));
  if (diffSec < 45) {
    return 'just now';
  }
  if (diffSec < 90) {
    return '1m';
  }
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m`;
  }
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) {
    return `${diffHr}h`;
  }
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) {
    return `${diffDay}d`;
  }
  const diffWk = Math.round(diffDay / 7);
  if (diffWk < 5) {
    return `${diffWk}w`;
  }
  return new Date(iso).toLocaleDateString();
}
