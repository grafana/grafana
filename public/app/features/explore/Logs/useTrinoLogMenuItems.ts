import { useMemo } from 'react';

import {
  DataQuery,
  DataSourceInstanceSettings,
  TimeRange,
  LogRowModel,
  LogsSortOrder,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { LogLineMenuCustomItem } from 'app/features/logs/components/panel/LogLineMenu';
import { LogListModel } from 'app/features/logs/components/panel/processing';
import { checkLogsSampled } from 'app/features/logs/utils';

import { useRunTrinoArchiveQuery } from './hooks/useRunTrinoArchiveQuery';

interface UseTrinoLogMenuItemsProps {
  datasourceType?: string;
  trinoDataSource: DataSourceInstanceSettings | null;
  timeRange: TimeRange;
  onEnrichedDataReceived?: (data: LogRowModel[] | null) => void;
  logRows?: LogRowModel[];
  logsQueries?: DataQuery[];
  exploreId: string;
  sortOrder?: LogsSortOrder;
}

// creates trino query menu item for logs lines if we are querying loki and trino is available
export function useTrinoLogMenuItems({
  datasourceType,
  trinoDataSource,
  timeRange,
  onEnrichedDataReceived,
  logRows,
  logsQueries,
  exploreId,
  sortOrder,
}: UseTrinoLogMenuItemsProps): LogLineMenuCustomItem[] {
  const { runArchiveQuery } = useRunTrinoArchiveQuery({
    trinoDataSource,
    timeRange,
    logsQueries,
    exploreId,
    onDataReceived: onEnrichedDataReceived,
    sortOrder,
  });
  
  return useMemo(() => {
    const tableName = config.trino?.logsArchiveTable;
    
    if (!tableName || datasourceType !== 'loki' || !trinoDataSource) {
      return [];
    }

    const trinoMenuItem: LogLineMenuCustomItem = {
      label: t('explore.logs.archive.enrich', 'Query All Logs from Archive'),
      // only shows if the log has the adaptive logs sampled warning
      shouldShow: (log: LogListModel) => {
        return !!checkLogsSampled(log);
      },
      onClick: async () => {
        await runArchiveQuery();
      },
    };

    return [
      { divider: true },
      trinoMenuItem,
    ];
  }, [datasourceType, trinoDataSource, runArchiveQuery]);
}

