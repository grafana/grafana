import { LOG_LINE_BODY_FIELD_NAME, OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME } from '../fieldSelector/logFields';
import { createLogLine } from '../mocks/logRow';

import {
  getDisplayedFieldsForLogs,
  getOtelAttributesField,
  getSuggestedFieldsForLogs,
  identifyOTelLanguage,
  identifyOTelLanguages,
  OTEL_LANGUAGE_UNKNOWN,
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
        'k8s.pod.name': 'nope',
        cluster: 'nope',
        namespace: 'nope',
        pod: 'nope',
        'service.name': 'nope',
        'host.name': 'nope',
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
        'telemetry.sdk.language': 'nope',
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

  test('Excludes dot-notation resource attributes the same as underscore-prefixed keys', () => {
    const log = createLogLine({
      labels: {
        'cloud.provider': 'nope',
        'cloud.region': 'nope',
        'container.id': 'nope',
        'deployment.environment': 'nope',
        'faas.name': 'nope',
        'gcp.project.id': 'nope',
        'os.type': 'nope',
        'process.pid': 'nope',
        'cluster.uid': 'nope',
        'namespace.uid': 'nope',
        custom_attr: 'keep',
      },
      entry: 'msg',
    });

    expect(getOtelAttributesField(log, true)).toEqual('custom_attr=keep');
  });

  test('Excludes dot-notation OTel log record fields the same as underscore keys', () => {
    const log = createLogLine({
      labels: {
        'observed.timestamp': 'nope',
        'severity.number': 'nope',
        'severity.text': 'nope',
        'span.id': 'nope',
        'trace.id': 'nope',
        user_dimension: 'keep',
      },
      entry: 'msg',
    });

    expect(getOtelAttributesField(log, true)).toEqual('user_dimension=keep');
  });
});

describe('identifyOTelLanguage', () => {
  test('returns undefined when OTel probe field is not present', () => {
    const log = createLogLine({ labels: { place: 'luna' }, entry: 'msg' });
    expect(identifyOTelLanguage(log)).toBeUndefined();
  });

  test('returns telemetry_sdk_language when OTel probe is present', () => {
    const log = createLogLine({
      labels: { [OTEL_PROBE_FIELD]: '1', telemetry_sdk_language: 'go' },
      entry: 'msg',
    });
    expect(identifyOTelLanguage(log)).toBe('go');
  });

  test('returns OTEL_LANGUAGE_UNKNOWN when OTel probe is present but no telemetry_sdk_language', () => {
    const log = createLogLine({
      labels: { [OTEL_PROBE_FIELD]: '1', exception_type: 'err' },
      entry: 'msg',
    });
    expect(identifyOTelLanguage(log)).toBe(OTEL_LANGUAGE_UNKNOWN);
  });

  test('returns otelLanguage when set on log', () => {
    const log = createLogLine({
      labels: { [OTEL_PROBE_FIELD]: '1', telemetry_sdk_language: 'php' },
      entry: 'msg',
    });
    log.otelLanguage = 'java';
    expect(identifyOTelLanguage(log)).toBe('java');
  });
});

describe('identifyOTelLanguages', () => {
  test('returns empty array for non-OTel logs', () => {
    const logs = [
      createLogLine({ labels: { a: '1' }, entry: 'msg' }),
      createLogLine({ labels: { b: '2' }, entry: 'msg' }),
    ];
    expect(identifyOTelLanguages(logs)).toEqual([]);
  });

  test('returns unique languages from OTel logs', () => {
    const logs = [
      createLogLine({
        labels: { [OTEL_PROBE_FIELD]: '1', telemetry_sdk_language: 'go' },
        entry: 'msg',
      }),
      createLogLine({
        labels: { [OTEL_PROBE_FIELD]: '1', telemetry_sdk_language: 'go' },
        entry: 'msg',
      }),
      createLogLine({
        labels: { [OTEL_PROBE_FIELD]: '1', telemetry_sdk_language: 'php' },
        entry: 'msg',
      }),
    ];
    expect(identifyOTelLanguages(logs)).toEqual(['go', 'php']);
  });
});

describe('getSuggestedFieldsForLogs', () => {
  test('returns only suggested fields that appear in logs for non-OTel logs', () => {
    const logs = [
      createLogLine({ labels: { service_name: 'svc', message: 'hello' }, entry: 'log 1' }),
      createLogLine({ labels: { app: 'web' }, entry: 'log 2' }),
    ];
    const result = getSuggestedFieldsForLogs(logs);
    expect(result).toContain('service_name');
    expect(result).toContain('message');
    expect(result).toContain('app');
    expect(result).not.toContain('traceID');
    expect(result).not.toContain('trace_id');
    expect(result).not.toContain('environment');
    expect(result).not.toContain('error');
    expect(result).not.toContain('scope_name');
    expect(result).not.toContain('msg');
  });

  test('includes body and OTel attributes when OTel is detected (they are in OTel suggested set)', () => {
    const logs = [
      createLogLine({
        labels: { [OTEL_PROBE_FIELD]: '1' },
        entry: 'log',
      }),
    ];
    const result = getSuggestedFieldsForLogs(logs);
    expect(result).toContain(LOG_LINE_BODY_FIELD_NAME);
    expect(result).toContain(OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME);
  });

  test('returns generic and OTel suggested fields when OTel is detected', () => {
    const logs = [
      createLogLine({
        labels: {
          [OTEL_PROBE_FIELD]: '1',
          service_name: 'svc',
          thread_name: 'main',
          exception_type: 'Error',
        },
        entry: 'log',
      }),
    ];
    const result = getSuggestedFieldsForLogs(logs);
    expect(result).toContain('service_name');
    expect(result).toContain('thread_name');
    expect(result).toContain('exception_type');
    expect(result).toContain(LOG_LINE_BODY_FIELD_NAME);
    expect(result).toContain(OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME);
  });

  test('returns empty array when logs have none of the suggested fields (non-OTel)', () => {
    const logs = [createLogLine({ labels: { custom_label: 'x' }, entry: 'log' })];
    const result = getSuggestedFieldsForLogs(logs);
    expect(result).toEqual([]);
  });
});
