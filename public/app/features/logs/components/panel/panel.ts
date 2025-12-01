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
    return LogListStyle.UnwrappedWithColumns;
  }
  return prettifyJSON ? LogListStyle.WrappedWithPrettyJSON : LogListStyle.Wrapped;
}

export function getLogListStyle(logOptionsStorageKey?: string) {
  return logOptionsStorageKey
    ? parseInt(store.getObject<string>(`${logOptionsStorageKey}.listStyle`) ?? '', 10) ||
        LogListStyle.UnwrappedWithColumns
    : LogListStyle.UnwrappedWithColumns;
}

export function prettifyJSON(listStyle: LogListStyle) {
  return listStyle === LogListStyle.WrappedWithPrettyJSON;
}

export function wrapLogMessage(listStyle: LogListStyle) {
  return listStyle === LogListStyle.Wrapped || listStyle === LogListStyle.WrappedWithPrettyJSON;
}
