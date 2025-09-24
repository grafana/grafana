import { LogRowModel } from '@grafana/data';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { LogListModel } from '../panel/processing';

/**
 * The presence of this field along log fields determines OTel origin.
 */
export const OTEL_PROBE_FIELD = 'severity_number';
const OTEL_LANGUAGE_UNKNOWN = 'unknown';
export function identifyOTelLanguages(logs: LogListModel[] | LogRowModel[]): string[] {
  const languagesSet = new Set<string>();
  logs.forEach((log) => {
    const lang = identifyOTelLanguage(log);
    if (lang !== undefined) {
      languagesSet.add(lang);
    }
  });
  return [...languagesSet];
}

export function identifyOTelLanguage(log: LogListModel | LogRowModel): string | undefined {
  if ('otelLanguage' in log && log.otelLanguage) {
    return log.otelLanguage;
  }
  return log.labels[OTEL_PROBE_FIELD] !== undefined
    ? (log.labels.telemetry_sdk_language ?? OTEL_LANGUAGE_UNKNOWN)
    : undefined;
}

export function getDisplayedFieldsForLanguages(logs: LogListModel[] | LogRowModel[], languages: string[]) {
  const displayedFields: string[] = [];

  languages.forEach((language) => {
    const format = getDisplayFormatForLanguage(language) ?? getDefaultOTelDisplayFormat();
    format.forEach((field) => {
      if (!displayedFields.includes(field)) {
        displayedFields.push(field);
      }
    });
  });

  return displayedFields.filter(
    (field) => field === LOG_LINE_BODY_FIELD_NAME || logs.some((log) => log.labels[field] !== undefined)
  );
}

export function getDisplayedFieldsForLogs(logs: LogListModel[] | LogRowModel[]): string[] {
  return getDisplayedFieldsForLanguages(logs, identifyOTelLanguages(logs));
}

// Languages not implemented.
export function getDisplayFormatForLanguage(language: string) {
  return undefined;
}

export function getDefaultOTelDisplayFormat() {
  return ['scope_name', 'thread_name', 'exception_type', 'exception_message', LOG_LINE_BODY_FIELD_NAME];
}

const OTEL_RESOURCE_ATTRS_REGEX =
  /^(aws_|cloud_|cloudfoundry_|container_|deployment_|faas_|gcp_|host_|k8s_|os_|process_|service_|telemetry_)/;
const OTEL_LOG_FIELDS_REGEX =
  /^(flags|observed_timestamp|scope_name|severity_number|severity_text|span_id|trace_id|detected_level)$/;

export function getOtelFormattedBody(log: LogListModel) {
  if (!log.otelLanguage) {
    return log.raw;
  }
  const additionalFields = Object.keys(log.labels).filter(
    (label) => !OTEL_RESOURCE_ATTRS_REGEX.test(label) && !OTEL_LOG_FIELDS_REGEX.test(label)
  );
  return (
    log.raw +
    ' ' +
    additionalFields.map((field) => (log.labels[field] ? `${field}=${log.labels[field]}` : '')).join(' ')
  );
}
