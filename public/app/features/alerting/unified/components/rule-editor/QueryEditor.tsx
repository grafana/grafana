import { css } from '@emotion/css';
import { useAsync } from 'react-use';

import { type DataSourceInstanceSettings, type GrafanaTheme2, type PanelData } from '@grafana/data';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { useStyles2 } from '@grafana/ui';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { QueryRows } from './QueryRows';

interface Props {
  panelData: Record<string, PanelData>;
  queries: AlertQuery[];
  expressions: AlertQuery[];
  onRunQueries: () => void;
  onChangeQueries: (queries: AlertQuery[]) => void;
  onDuplicateQuery: (query: AlertQuery) => void;
  condition: string | null;
  onSetCondition: (refId: string) => void;
}

export const QueryEditor = ({
  queries,
  expressions,
  panelData,
  onRunQueries,
  onChangeQueries,
  onDuplicateQuery,
  condition,
  onSetCondition,
}: Props) => {
  const styles = useStyles2(getStyles);
  const { settingsByUid, isLoading } = useDataSourceSettingsByUid(queries.map((query) => query.datasourceUid));

  return (
    <div className={styles.container}>
      <QueryRows
        data={panelData}
        queries={queries}
        expressions={expressions}
        onRunQueries={onRunQueries}
        onQueriesChange={onChangeQueries}
        onDuplicateQuery={onDuplicateQuery}
        condition={condition}
        onSetCondition={onSetCondition}
        dataSourceSettingsByUid={settingsByUid}
        isLoadingDataSourceSettings={isLoading}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    backgroundColor: theme.colors.background.primary,
    height: '100%',
  }),
});

interface UseDataSourceSettingsByUidResult {
  settingsByUid: Record<string, DataSourceInstanceSettings>;
  isLoading: boolean;
}

// QueryRows is a class component and can't use hooks, so settings are resolved here instead.
function useDataSourceSettingsByUid(uids: string[]): UseDataSourceSettingsByUidResult {
  const uniqueUids = Array.from(new Set(uids)).sort();
  const uidsKey = uniqueUids.join(',');

  const { value, loading } = useAsync(async () => {
    const settingsList = await Promise.all(uniqueUids.map((uid) => getDataSourceInstanceSettings(uid)));
    const entries = uniqueUids
      .map((uid, index): [string, DataSourceInstanceSettings | undefined] => [uid, settingsList[index]])
      .filter((entry): entry is [string, DataSourceInstanceSettings] => entry[1] !== undefined);
    return Object.fromEntries(entries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uidsKey]);

  return { settingsByUid: value ?? {}, isLoading: loading };
}
