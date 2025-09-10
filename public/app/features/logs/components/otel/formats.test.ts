import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { createLogLine } from '../mocks/logRow';

import { getDisplayedFieldsForLogs, getOtelFormattedBody, OTEL_PROBE_FIELD } from './formats';

describe('getDisplayedFieldsForLogs', () => {
  test('Does not return displayed fields if not an OTel log line', () => {
    const log = createLogLine({ labels: { place: 'luna' }, entry: `place="luna" 1ms 3 KB` });

    expect(getDisplayedFieldsForLogs([log])).toEqual([]);
  });

  test('Does not return displayed fields if the OTel probe field is not present', () => {
    const log = createLogLine({ labels: { severity_level: '1' }, entry: `place="luna" 1ms 3 KB` });

    expect(getDisplayedFieldsForLogs([log])).toEqual([]);
  });

  test('Returns displayed fields if the OTel probe field is present', () => {
    const log = createLogLine({
      labels: { [OTEL_PROBE_FIELD]: '1', telemetry_sdk_language: 'php', scope_name: 'scope' },
      entry: `place="luna" 1ms 3 KB`,
    });

    expect(getDisplayedFieldsForLogs([log])).toEqual(['scope_name', LOG_LINE_BODY_FIELD_NAME]);
    expect(log.otelLanguage).toBe('php');
  });

  test('Returns displayed fields if the OTel probe field is present and the language unknown', () => {
    const log = createLogLine({
      labels: { [OTEL_PROBE_FIELD]: '1', scope_name: 'scope' },
      entry: `place="luna" 1ms 3 KB`,
    });

    expect(getDisplayedFieldsForLogs([log])).toEqual(['scope_name', LOG_LINE_BODY_FIELD_NAME]);
    expect(log.otelLanguage).toBe('unknown');
  });
});

describe('getOtelFormattedBody', () => {
  test('Does not modify non OTel logs', () => {
    const log = createLogLine({ labels: { place: 'luna' }, entry: `place="luna" 1ms 3 KB` });
    expect(getOtelFormattedBody(log)).toEqual(`place="luna" 1ms 3 KB`);
  });

  test('Returns an OTel augmented log line body', () => {
    const log = createLogLine({
      labels: {
        severity_number: '1',
        telemetry_sdk_language: 'php',
        scope_name: 'scope',
        aws_ignore: 'ignored',
        key: 'value',
        otel: 'otel',
      },
      entry: `place="luna" 1ms 3 KB`,
    });
    expect(getOtelFormattedBody(log)).toEqual(`place="luna" 1ms 3 KB key=value otel=otel`);
  });
});
