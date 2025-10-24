import { LogRowModel } from '@grafana/data';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { LogListModel, NEWLINES_REGEX } from '../panel/processing';

/**
 * The presence of this field along log fields determines OTel origin.
 */
export const OTEL_PROBE_FIELD = 'severity_number';
const OTEL_LANGUAGE_UNKNOWN = 'unknown';

function identifyOTelLanguages(logs: LogListModel[] | LogRowModel[]): string[] {
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

function getDisplayedFieldsForLanguages(logs: LogListModel[] | LogRowModel[], languages: string[]) {
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
    (field) =>
      field === LOG_LINE_BODY_FIELD_NAME ||
      field === OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME ||
      logs.some((log) => log.labels[field] !== undefined)
  );
}

/***
 * Given a list of logs, identify the OTel language for each, use the language to match displayed fields
 * and return a list of fields to display based on the languages present in the logs.
 */
export function getDisplayedFieldsForLogs(logs: LogListModel[] | LogRowModel[]): string[] {
  return getDisplayedFieldsForLanguages(logs, identifyOTelLanguages(logs));
}

// Languages not implemented.
function getDisplayFormatForLanguage(language: string) {
  return undefined;
}

/***
 * Given a list of logs, return a list of suggested fields to display for the user.
 */
export function getSuggestedFieldsForLogs(logs: LogListModel[] | LogRowModel[]): string[] {
  const languages = identifyOTelLanguages(logs);
  if (!languages.length) {
    return [];
  }
  const fields = getSuggestedOTelDisplayFormat();

  return fields.filter(
    (field) =>
      field === LOG_LINE_BODY_FIELD_NAME ||
      field === OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME ||
      logs.some((log) => log.labels[field] !== undefined)
  );
}

function getSuggestedOTelDisplayFormat() {
  return ['scope_name', ...getDefaultOTelDisplayFormat()];
}

function getDefaultOTelDisplayFormat() {
  return [
    'thread_name',
    'exception_type',
    'exception_message',
    LOG_LINE_BODY_FIELD_NAME,
    OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME,
  ];
}

const OTEL_RESOURCE_ATTRS_REGEX =
  /^(aws_|cloud_|cloudfoundry_|container_|deployment_|faas_|gcp_|host_|k8s_|os_|process_|service_|telemetry_|cluster$|namespace$|pod$)/;
const OTEL_LOG_FIELDS_REGEX =
  /^(flags|observed_timestamp|severity_number|severity_text|span_id|trace_id|detected_level)$/;

export const OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME = '___OTEL_LOG_ATTRIBUTES___';

export function getOtelAttributesField(log: LogListModel, wrapLogMessage: boolean) {
  const additionalFields = Object.keys(log.labels).filter(
    (label) =>
      !OTEL_RESOURCE_ATTRS_REGEX.test(label) &&
      !OTEL_LOG_FIELDS_REGEX.test(label) &&
      label !== OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME
  );
  const attributes = additionalFields
    .map((field) => (log.labels[field] ? `${field}=${log.labels[field]}` : ''))
    .join(' ');
  if (!wrapLogMessage) {
    return attributes.replace(NEWLINES_REGEX, '');
  }
  return attributes;
}
