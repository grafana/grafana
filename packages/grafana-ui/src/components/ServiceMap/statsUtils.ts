import { pick } from 'lodash';
import { XrayEdge, XrayService } from './types';

export interface Stats {
  success: number;
  throttled: number;
  errors: number;
  faults: number;
  avgResponseTime: number;
  tracesPerMinute?: number;
  tracesCount: number;
}

type Ratio = 'success' | 'errors' | 'faults' | 'throttled';

export function computeStats(serviceOrEdge: XrayService | XrayEdge): Stats | undefined {
  const { SummaryStatistics, StartTime, EndTime, ResponseTimeHistogram } = serviceOrEdge;
  if (!SummaryStatistics) {
    return computeStats((serviceOrEdge as XrayService).Edges[0]);
  }
  const { TotalCount, OkCount, ErrorStatistics, FaultStatistics, TotalResponseTime } = SummaryStatistics;

  return {
    success: OkCount / TotalCount,
    throttled: ErrorStatistics.ThrottleCount / TotalCount,
    errors: (ErrorStatistics.TotalCount - ErrorStatistics.ThrottleCount) / TotalCount,
    faults: FaultStatistics.TotalCount / TotalCount,
    avgResponseTime: (TotalResponseTime / TotalCount) * 1000,
    tracesPerMinute: EndTime && StartTime ? TotalCount / ((toMs(EndTime) - toMs(StartTime)) / (60 * 1000)) : undefined,
    tracesCount: ResponseTimeHistogram.reduce((acc, h) => acc + h.Count, 0),
  };
}

function toMs(time: number | string): number {
  if (typeof time === 'number') {
    return time * 1000;
  } else {
    return new Date(time).valueOf();
  }
}

export function getRatios(
  stats: Stats
): {
  nonZero: Ratio[];
  fullStat: Ratio | undefined;
} {
  const ratios = pick(stats, 'faults', 'errors', 'throttled', 'success');
  const statsArray = (Object.keys(ratios) as Ratio[]).filter(k => stats[k as Ratio] > 0);
  const fullStat = statsArray.find(k => stats[k as Ratio] === 1);
  return { nonZero: statsArray, fullStat };
}
