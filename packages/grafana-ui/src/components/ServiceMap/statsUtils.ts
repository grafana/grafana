import { pick } from 'lodash';
import { XrayEdge, XrayService } from './types';

export interface Stats {
  success: number;
  throttled: number;
  errors: number;
  faults: number;
  avgResponseTime: number;
  tracesPerMinute: number;
}

type Ratio = 'success' | 'errors' | 'faults' | 'throttled';

export function computeStats(serviceOrEdge: XrayService | XrayEdge): Stats | undefined {
  const { SummaryStatistics, StartTime, EndTime } = serviceOrEdge;
  if (!SummaryStatistics) {
    return undefined;
  }
  const { TotalCount, OkCount, ErrorStatistics, FaultStatistics, TotalResponseTime } = SummaryStatistics;
  const startTimeMs = new Date(StartTime).valueOf();
  const endTimeMs = new Date(EndTime).valueOf();

  return {
    success: OkCount / TotalCount,
    throttled: ErrorStatistics.ThrottleCount / TotalCount,
    errors: ErrorStatistics.TotalCount - ErrorStatistics.ThrottleCount / TotalCount,
    faults: FaultStatistics.TotalCount / TotalCount,
    avgResponseTime: TotalResponseTime / TotalCount,
    tracesPerMinute: TotalCount / ((endTimeMs - startTimeMs) / (1000 * 60)),
  };
}

export function getRatios(
  stats: Stats
): {
  nonZero: Ratio[];
  fullStat: Ratio | undefined;
} {
  const ratios = pick(stats, 'success', 'errors', 'faults', 'throttled');
  const statsArray = (Object.keys(ratios) as Ratio[]).filter(k => stats[k as keyof Stats] > 0);
  const fullStat = statsArray.find(k => stats[k as keyof Stats] === 1);
  return { nonZero: statsArray, fullStat };
}
