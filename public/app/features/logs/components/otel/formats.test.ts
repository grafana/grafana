import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { createLogLine } from '../mocks/logRow';

import {
  getDisplayedFieldsForLogs,
  getOtelAttributesField,
  OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME,
  OTEL_PROBE_FIELD,
} from './formats';

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
      labels: { [OTEL_PROBE_FIELD]: '1', telemetry_sdk_language: 'php', thread_name: 'John' },
      entry: `place="luna" 1ms 3 KB`,
    });

    expect(getDisplayedFieldsForLogs([log])).toEqual([
      'thread_name',
      LOG_LINE_BODY_FIELD_NAME,
      OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME,
    ]);
    expect(log.otelLanguage).toBe('php');
  });

  test('Returns displayed fields if the OTel probe field is present and the language unknown', () => {
    const log = createLogLine({
      labels: { [OTEL_PROBE_FIELD]: '1', exception_type: 'fatal', exception_message: 'message' },
      entry: `place="luna" 1ms 3 KB`,
    });

    expect(getDisplayedFieldsForLogs([log])).toEqual([
      'exception_type',
      'exception_message',
      LOG_LINE_BODY_FIELD_NAME,
      OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME,
    ]);
    expect(log.otelLanguage).toBe('unknown');
  });

  test('Returns the minimal displayed fields if others are not present', () => {
    const log = createLogLine({
      labels: { [OTEL_PROBE_FIELD]: '1' },
      entry: `place="luna" 1ms 3 KB`,
    });

    expect(getDisplayedFieldsForLogs([log])).toEqual([LOG_LINE_BODY_FIELD_NAME, OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME]);
  });
});

describe('getOtelAttributesField', () => {
  test('Builds the OTel attributes fields from the log line fields including and excluding fields', () => {
    const log = createLogLine({
      labels: {
        aws_something: 'nope',
        k8s_something: 'nope',
        cluster: 'nope',
        namespace: 'nope',
        pod: 'nope',
        vcs_ref_head_name: 'main',
        field: 'value',
      },
      entry: `place="luna" 1ms 3 KB`,
    });

    expect(getOtelAttributesField(log, true)).toEqual('vcs_ref_head_name=main field=value');
  });

  test('Correctly matches excluded labels', () => {
    const log = createLogLine({
      labels: {
        aws_something: 'nope',
        k8s_something: 'nope',
        cluster: 'nope',
        namespace: 'nope',
        pod: 'nope',
        cluster_1: 'yes',
        namespace_2: 'yes',
        pod_3: 'yes',
        vcs_ref_head_name: 'main',
        field: 'value',
      },
      entry: `place="luna" 1ms 3 KB`,
    });

    expect(getOtelAttributesField(log, true)).toEqual(
      'cluster_1=yes namespace_2=yes pod_3=yes vcs_ref_head_name=main field=value'
    );
  });

  test('Removes new lines when wrapping is disabled', () => {
    const log = createLogLine({
      labels: {
        aws_something: 'nope',
        k8s_something: 'nope',
        cluster: 'nope',
        namespace: 'nope',
        pod: 'nope',
        vcs_ref_head_name: 'ma\nin',
        field: 'val\nue',
      },
      entry: `place="luna" 1ms 3 KB`,
    });

    expect(getOtelAttributesField(log, false)).toEqual('vcs_ref_head_name=main field=value');
  });
});
