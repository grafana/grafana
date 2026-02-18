import { LOG_LINE_BODY_FIELD_NAME } from 'app/features/logs/components/LogDetailsBody';

import type { Options as LogsTableOptions } from '../panelcfg.gen';

export const getDisplayedFields = (options: LogsTableOptions, timeFieldName: string, bodyFieldName: string) => {
  return options.displayedFields?.length ? options.displayedFields : [timeFieldName, LOG_LINE_BODY_FIELD_NAME];
};
