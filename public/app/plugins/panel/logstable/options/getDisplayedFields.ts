import { LOG_LINE_BODY_FIELD_NAME } from 'app/features/logs/components/fieldSelector/logFields';

import type { Options as LogsTableOptions } from '../panelcfg.gen';

export const getDisplayedFields = (options: LogsTableOptions, timeFieldName: string, levelFieldName: string) => {
  return options.displayedFields?.length
    ? options.displayedFields
    : [timeFieldName, levelFieldName, LOG_LINE_BODY_FIELD_NAME];
};
