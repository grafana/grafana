import { LogListStyle, store } from '@grafana/data';

export function getLogListStyleFromOldProps(
  wrapLogMessage: boolean | undefined,
  prettifyJSON: boolean | undefined,
  logOptionsStorageKey: string | undefined
) {
  if (wrapLogMessage === undefined) {
    wrapLogMessage = store.getBool(`${logOptionsStorageKey}.wrapLogMessage`, false);
  }
  if (wrapLogMessage === undefined) {
    prettifyJSON = store.getBool(`${logOptionsStorageKey}.prettifyLogMessage`, true);
  }

  if (!wrapLogMessage) {
    return LogListStyle.InlineWithColumns;
  }
  return prettifyJSON ? LogListStyle.WrappedWithPrettyJSON : LogListStyle.Wrapped;
}

export function getLogListStyle(logOptionsStorageKey?: string) {
  const stored = logOptionsStorageKey
    ? store.getObject<string>(`${logOptionsStorageKey}.listStyle`)
    : LogListStyle.Inline;
  if (stored === LogListStyle.InlineWithColumns) {
    return LogListStyle.InlineWithColumns;
  } else if (stored === LogListStyle.Wrapped) {
    return LogListStyle.Wrapped;
  } else if (stored === LogListStyle.WrappedWithPrettyJSON) {
    return LogListStyle.WrappedWithPrettyJSON;
  }

  return LogListStyle.Inline;
}

export function prettifyJSON(listStyle: LogListStyle) {
  return listStyle === LogListStyle.WrappedWithPrettyJSON;
}

export function wrapLogMessage(listStyle: LogListStyle) {
  return listStyle === LogListStyle.Wrapped || listStyle === LogListStyle.WrappedWithPrettyJSON;
}
