import type { Options as LogsTableOptions } from '../panelcfg.gen';

export const getDisplayedFields = (options: LogsTableOptions, timeFieldName: string, bodyFieldName: string) => {
  return options.displayedFields?.length ? options.displayedFields : [timeFieldName, bodyFieldName];
};
