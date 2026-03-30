import { type LogsFrame } from 'app/features/logs/logsFrame';

// Fallback for Loki data source which doesn't have a severity field and uses the detected_level label
// See https://github.com/grafana/grafana/blob/32b04b72d31b17c5dc81c3090dea30b0ea63951f/public/app/features/logs/logsModel.ts#L422
export function detectLevelField(logsFrame: LogsFrame | null) {
  if (!logsFrame) {
    return undefined;
  }
  const labels = logsFrame.getLogFrameLabelsAsLabels();
  if (labels?.find((logLabels) => logLabels['detected_level'])) {
    return 'detected_level';
  }
  if (labels?.find((logLabels) => logLabels['level'])) {
    return 'level';
  }
  return undefined;
}
