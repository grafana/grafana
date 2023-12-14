/**
 * A library containing logic to manage traces.
 *
 * @packageDocumentation
 */

import { IntervalInput } from './IntervalInput/IntervalInput';
import { TagMappingInput } from './TraceToLogs/TagMappingInput';
import * as TraceToLogsSettings from './TraceToLogs/TraceToLogsSettings';
import * as TraceToMetricsSettings from './TraceToMetrics/TraceToMetricsSettings';
import * as TraceToProfilesSettings from './TraceToProfiles/TraceToProfilesSettings';
import { getNonOverlappingDuration, getStats, makeFrames, makeSpanMap } from './utils';

export {
  IntervalInput,
  TagMappingInput,
  TraceToLogsSettings,
  TraceToMetricsSettings,
  TraceToProfilesSettings,
  getNonOverlappingDuration,
  getStats,
  makeFrames,
  makeSpanMap,
};

// dummy type
export type Props = {
  value?: string;
};
