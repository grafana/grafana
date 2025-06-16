import { LogRowModel } from '@grafana/data';

import { LOG_LINE_BODY_FIELD_NAME } from '../LogDetailsBody';
import { LogListModel } from '../panel/processing';

/**
 * The presence of this field along log fields determines OTel origin.
 */
const OTEL_PROBE_FIELD = 'severity_number';
export function identifyOTelLanguages(logs: LogListModel[] | LogRowModel[]): string[] {
	const languages = logs
    .filter((log) => log.labels[OTEL_PROBE_FIELD] !== undefined)
    .filter((log) => log.labels.telemetry_sdk_language !== undefined)
    .map((log) => log.labels.telemetry_sdk_language);
  return [...new Set(languages)];
}

export function getDisplayedFieldsForLanguages(languages: string[]) {
  const displayedFields: string[] = [];

  languages.forEach((language) => {
    const format = getDisplayFormatForLanguage(language) ?? getDefaultOTelDisplayFormat();
    format.forEach((field) => {
      if (!displayedFields.includes(field)) {
        displayedFields.push(field);
      }
    });
  });

  return displayedFields;
}

export function getDisplayedFieldsForLogs(logs: LogListModel[] | LogRowModel[]): string[] {
  console.log(identifyOTelLanguages(logs));
  console.log(getDisplayedFieldsForLanguages(identifyOTelLanguages(logs)));

  return getDisplayedFieldsForLanguages(identifyOTelLanguages(logs));
}

export function getDisplayFormatForLanguage(language: string) {
  return undefined;
}

export function getDefaultOTelDisplayFormat() {
  return ['severity_text', 'scope_name', 'exception_type', 'exception_message', LOG_LINE_BODY_FIELD_NAME];
}
