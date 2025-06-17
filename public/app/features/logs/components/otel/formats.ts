import { LogRowModel } from '@grafana/data';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { LogListModel } from '../panel/processing';

/**
 * The presence of this field along log fields determines OTel origin.
 */
const OTEL_PROBE_FIELD = 'severity_number';
export function identifyOTelLanguages(logs: LogListModel[] | LogRowModel[]): string[] {
  const languages = logs.map((log) => identifyOTelLanguage(log)).filter((language) => language !== undefined);
  return [...new Set(languages)];
}

export function identifyOTelLanguage(log: LogListModel | LogRowModel): string | undefined {
  if ('otelLanguage' in log && log.otelLanguage) {
    return log.otelLanguage;
  }
  return log.labels[OTEL_PROBE_FIELD] !== undefined && log.labels.telemetry_sdk_language
    ? log.labels.telemetry_sdk_language
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

export function getDisplayFormatForLanguage(language: string) {
  return undefined;
}

export function getDefaultOTelDisplayFormat() {
  return ['severity_text', 'scope_name', 'exception_type', 'exception_message', LOG_LINE_BODY_FIELD_NAME];
}

export function getOtelFormattedBody(log: LogListModel) {
  if (!log.otelLanguage) {
    return log.raw;
  }
  const additionalFields = ['timestamp', 'detected_level', 'flags', 'scope_name', 'trace_id', 'span_id'];
  return (
    log.raw +
    ' ' +
    additionalFields.map((field) => (log.labels[field] ? `${field}=${log.labels[field]}` : '')).join(' ')
  );
}
