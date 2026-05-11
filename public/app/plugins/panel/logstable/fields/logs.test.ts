import type { LogsFrame } from 'app/features/logs/logsFrame';

import { detectLevelField } from './logs';

function makeLogsFrame(labelsPerRow: Array<Record<string, string>> | null): LogsFrame {
  return {
    getLogFrameLabelsAsLabels: () => labelsPerRow,
  } as LogsFrame;
}

describe('detectLevelField', () => {
  it('returns undefined when logsFrame is null', () => {
    expect(detectLevelField(null)).toBeUndefined();
  });

  it('returns undefined when getLogFrameLabelsAsLabels returns null', () => {
    const frame = makeLogsFrame(null);
    expect(detectLevelField(frame)).toBeUndefined();
  });

  it('returns undefined when there are no label rows', () => {
    const frame = makeLogsFrame([]);
    expect(detectLevelField(frame)).toBeUndefined();
  });

  it('returns undefined when no row has detected_level or level', () => {
    const frame = makeLogsFrame([{ app: 'foo' }, { service: 'bar' }]);
    expect(detectLevelField(frame)).toBeUndefined();
  });

  it("returns 'detected_level' when any row has a truthy detected_level label", () => {
    const frame = makeLogsFrame([{ app: 'a' }, { detected_level: 'error' }]);
    expect(detectLevelField(frame)).toBe('detected_level');
  });

  it('prefers detected_level over level when both appear across rows', () => {
    const frame = makeLogsFrame([{ level: 'info' }, { detected_level: 'warn' }]);
    expect(detectLevelField(frame)).toBe('detected_level');
  });

  it("returns 'level' when no row has detected_level but a row has level", () => {
    const frame = makeLogsFrame([{ app: 'x' }, { level: 'debug' }]);
    expect(detectLevelField(frame)).toBe('level');
  });

  it('does not treat empty detected_level string as present', () => {
    const frame = makeLogsFrame([{ detected_level: '' }, { level: 'info' }]);
    expect(detectLevelField(frame)).toBe('level');
  });
});
