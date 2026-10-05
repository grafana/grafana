import { css } from '@emotion/css';
import { memo, useEffect, useRef, useState } from 'react';

import {
  CoreApp,
  type DataSourceApi,
  type DataSourceInstanceSettings,
  type GrafanaTheme2,
  type ScopedVars,
  getDataSourceRef,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { getDataSourceInstance, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type DataQuery } from '@grafana/schema';
import { Button, InlineFormLabel, Modal, ScrollContainer, Stack, useStyles2 } from '@grafana/ui';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';
import config from 'app/core/config';
import { addQuery, queryIsEmpty } from 'app/core/utils/query';
import { DataSourceModal } from 'app/features/datasources/components/picker/DataSourceModal';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { dataSource as expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { isSharedDashboardQuery } from 'app/plugins/datasource/dashboard/runSharedRequest';
import { type GrafanaQuery } from 'app/plugins/datasource/grafana/types';
import { type QueryGroupOptions } from 'app/types/query';

import { type PanelQueryRunner } from '../state/PanelQueryRunner';
import { updateQueries } from '../state/updateQueries';

import { GroupActionComponents } from './QueryActionComponent';
import { QueryEditorRows } from './QueryEditorRows';
import { QueryGroupOptionsEditor } from './QueryGroupOptions';

export interface Props {
  queryRunner: PanelQueryRunner;
  options: QueryGroupOptions;
  onOpenQueryInspector?: () => void;
  onRunQueries: () => void;
  onOptionsChange: (options: QueryGroupOptions) => void;
}

async function loadQueriesAndDatasource(options: QueryGroupOptions) {
  const ds = await getDataSourceInstance(options.dataSource);
  const dsSettings = await getDataSourceInstanceSettings(options.dataSource);

  const defaultDataSource = await getDataSourceInstance();
  const datasource = ds.getRef();
  const queries = options.queries.map((q) => ({
    ...(queryIsEmpty(q) && ds?.getDefaultQuery?.(CoreApp.PanelEditor)),
    datasource,
    ...q,
  }));

  return { ds, dsSettings, defaultDataSource, queries };
}

function isExpressionsSupported(dsSettings: DataSourceInstanceSettings): boolean {
  return (dsSettings.meta.backend || dsSettings.meta.alerting || dsSettings.meta.mixed) === true;
}

export const QueryGroup = memo(function QueryGroup({
  queryRunner,
  options,
  onOpenQueryInspector,
  onRunQueries,
  onOptionsChange,
}: Props) {
  const styles = useStyles2(getStyles);
  const [dataSource, setDataSource] = useState<DataSourceApi>();
  const [dsSettings, setDsSettings] = useState<DataSourceInstanceSettings>();
  const [defaultDataSource, setDefaultDataSource] = useState<DataSourceApi>();
  const [queries, setQueries] = useState<DataQuery[]>([]);
  const [data, setData] = useState<PanelData>(() => ({
    state: LoadingState.NotStarted,
    series: [],
    timeRange: getDefaultTimeRange(),
  }));
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const subscription = queryRunner.getData({ withTransforms: false, withFieldConfig: false }).subscribe({
      next: setData,
    });
    return () => subscription.unsubscribe();
  }, [queryRunner]);

  // Loads on mount, then reloads whenever the data source in options diverges from the one in state
  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        if (dataSource) {
          const currentDS = await getDataSourceInstance(options.dataSource);
          if (ignore || currentDS.uid === dataSource.uid) {
            return;
          }
        }

        const result = await loadQueriesAndDatasource(options);
        if (ignore) {
          return;
        }
        setQueries(result.queries);
        setDataSource(result.ds);
        setDsSettings(result.dsSettings);
        setDefaultDataSource(result.defaultDataSource);
      } catch (error) {
        console.error('failed to load data source', error);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [options, dataSource]);

  const onChange = (changedProps: Partial<QueryGroupOptions>) => {
    onOptionsChange({
      ...options,
      ...changedProps,
    });
  };

  const onQueriesChange = (newQueries: DataQuery[] | GrafanaQuery[]) => {
    onChange({ queries: newQueries });
    setQueries(newQueries);
  };

  const onScrollBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: 10000 });
    }, 20);
  };

  const onChangeDataSource = async (
    newSettings: DataSourceInstanceSettings,
    defaultQueries?: DataQuery[] | GrafanaQuery[]
  ) => {
    const currentDS = dsSettings ? await getDataSourceInstance(dsSettings.uid) : undefined;
    const nextDS = await getDataSourceInstance(newSettings.uid);

    // We need to pass in newSettings.uid as well here as that can be a variable expression and we want to store that in the query model not the current ds variable value
    const newQueries = defaultQueries || (await updateQueries(nextDS, newSettings.uid, queries, currentDS));

    const newDataSource = await getDataSourceInstance(newSettings.name);

    onChange({
      queries: newQueries,
      dataSource: {
        name: newSettings.name,
        uid: newSettings.uid,
        ...getDataSourceRef(newSettings),
      },
    });

    setQueries(newQueries);
    setDataSource(newDataSource);
    setDsSettings(newSettings);

    if (defaultQueries) {
      onRunQueries();
    }
  };

  const onAddQueryClick = () => {
    const ds =
      dsSettings && !dsSettings.meta.mixed
        ? getDataSourceRef(dsSettings)
        : defaultDataSource
          ? defaultDataSource.getRef()
          : { type: undefined, uid: undefined };

    onQueriesChange(
      addQuery(queries, {
        ...dataSource?.getDefaultQuery?.(CoreApp.PanelEditor),
        datasource: ds,
      })
    );
    onScrollBottom();
  };

  const onAddExpressionClick = () => {
    onQueriesChange(addQuery(queries, expressionDatasource.newQuery()));
    onScrollBottom();
  };

  const onAddQuery = (query: Partial<DataQuery>) => {
    onQueriesChange(
      addQuery(queries, query, dsSettings ? getDataSourceRef(dsSettings) : { type: undefined, uid: undefined })
    );
    onScrollBottom();
  };

  const onUpdateAndRun = (newOptions: QueryGroupOptions) => {
    onOptionsChange(newOptions);
    onRunQueries();
  };

  return (
    <ScrollContainer minHeight="100%" ref={scrollRef}>
      <div className={styles.innerWrapper}>
        {dsSettings && dataSource && (
          <QueryGroupTopSection
            data={data}
            dataSource={dataSource}
            options={options}
            dsSettings={dsSettings}
            onOptionsChange={onUpdateAndRun}
            onDataSourceChange={onChangeDataSource}
            onOpenQueryInspector={onOpenQueryInspector}
          />
        )}
        {dsSettings && (
          <>
            <div className={styles.queriesWrapper}>
              <div data-testid={selectors.components.QueryTab.content}>
                <QueryEditorRows
                  queries={queries}
                  dsSettings={dsSettings}
                  onQueriesChange={onQueriesChange}
                  onAddQuery={onAddQuery}
                  onRunQueries={onRunQueries}
                  data={data}
                />
              </div>
            </div>
            <Stack gap={2} alignItems="flex-start">
              {!isSharedDashboardQuery(dsSettings.name) && (
                <Button
                  icon="plus"
                  onClick={onAddQueryClick}
                  variant="secondary"
                  data-testid={selectors.components.QueryTab.addQuery}
                >
                  <Trans i18nKey="query.query-group.add-query">Add query</Trans>
                </Button>
              )}
              {config.expressionsEnabled && isExpressionsSupported(dsSettings) && (
                <Button
                  icon="plus"
                  onClick={onAddExpressionClick}
                  variant="secondary"
                  className={styles.expressionButton}
                  data-testid="query-tab-add-expression"
                >
                  <span>
                    <Trans i18nKey="query.query-group.expression">Expression</Trans>
                  </span>
                </Button>
              )}
              {GroupActionComponents.getAllExtraRenderAction()
                .map((action, index) =>
                  action({
                    onAddQuery,
                    onChangeDataSource,
                    key: index,
                  })
                )
                .filter(Boolean)}
            </Stack>
          </>
        )}
      </div>
    </ScrollContainer>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  innerWrapper: css({
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2),
  }),
  dataSourceRow: css({
    display: 'flex',
    marginBottom: theme.spacing(2),
  }),
  dataSourceRowItem: css({
    marginRight: theme.spacing(0.5),
  }),
  dataSourceRowItemOptions: css({
    flexGrow: 1,
    marginRight: theme.spacing(0.5),
  }),
  queriesWrapper: css({
    paddingBottom: theme.spacing(2),
  }),
  expressionButton: css({
    marginRight: theme.spacing(1),
  }),
});

interface QueryGroupTopSectionProps {
  data: PanelData;
  dataSource: DataSourceApi;
  dsSettings: DataSourceInstanceSettings;
  options: QueryGroupOptions;
  scopedVars?: ScopedVars;
  onOpenQueryInspector?: () => void;
  onOptionsChange?: (options: QueryGroupOptions) => void;
  onDataSourceChange?: (ds: DataSourceInstanceSettings, defaultQueries?: DataQuery[] | GrafanaQuery[]) => Promise<void>;
}

export function QueryGroupTopSection({
  dataSource,
  options,
  data,
  dsSettings,
  scopedVars,
  onDataSourceChange,
  onOptionsChange,
  onOpenQueryInspector,
}: QueryGroupTopSectionProps) {
  const styles = useStyles2(getStyles);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <>
      <div data-testid={selectors.components.QueryTab.queryGroupTopSection}>
        <div className={styles.dataSourceRow}>
          <InlineFormLabel htmlFor="data-source-picker" width={'auto'}>
            <Trans i18nKey="query.query-group-top-section.data-source">Data source</Trans>
          </InlineFormLabel>
          <div className={styles.dataSourceRowItem}>
            <DataSourcePickerWithPrompt
              options={options}
              scopedVars={scopedVars}
              onChange={async (ds, defaultQueries) => {
                return await onDataSourceChange?.(ds, defaultQueries);
              }}
              isDataSourceModalOpen={Boolean(locationService.getSearchObject().firstPanel)}
            />
          </div>
          {dataSource && (
            <>
              <div className={styles.dataSourceRowItem}>
                <Button
                  variant="secondary"
                  icon="question-circle"
                  tooltip={t(
                    'query.query-group-top-section.query-tab-help-button-title-open-data-source-help',
                    'Open data source help'
                  )}
                  onClick={() => setIsHelpOpen(true)}
                  data-testid="query-tab-help-button"
                />
              </div>
              <div className={styles.dataSourceRowItemOptions}>
                <QueryGroupOptionsEditor
                  options={options}
                  dataSource={dataSource}
                  data={data}
                  onChange={(opts) => {
                    onOptionsChange?.(opts);
                  }}
                />
              </div>
              {onOpenQueryInspector && (
                <div className={styles.dataSourceRowItem}>
                  <Button
                    variant="secondary"
                    onClick={onOpenQueryInspector}
                    data-testid={selectors.components.QueryTab.queryInspectorButton}
                  >
                    <Trans i18nKey="query.query-group-top-section.query-inspector">Query inspector</Trans>
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {isHelpOpen && (
        <Modal
          title={t('query.query-group-top-section.title-data-source-help', 'Data source help')}
          isOpen={true}
          onDismiss={() => setIsHelpOpen(false)}
        >
          <PluginHelp pluginId={dsSettings.meta.id} />
        </Modal>
      )}
    </>
  );
}

interface DataSourcePickerWithPromptProps {
  isDataSourceModalOpen?: boolean;
  options: QueryGroupOptions;
  scopedVars?: ScopedVars;
  onChange: (ds: DataSourceInstanceSettings, defaultQueries?: DataQuery[] | GrafanaQuery[]) => Promise<void>;
}

function DataSourcePickerWithPrompt({ options, scopedVars, onChange, ...otherProps }: DataSourcePickerWithPromptProps) {
  const [isDataSourceModalOpen, setIsDataSourceModalOpen] = useState(Boolean(otherProps.isDataSourceModalOpen));

  useEffect(() => {
    // Clean up the first panel flag since the modal is now open
    if (!!locationService.getSearchObject().firstPanel) {
      locationService.partial({ firstPanel: null }, true);
    }
  }, []);

  const commonProps = {
    metrics: true,
    mixed: true,
    dashboard: true,
    variables: true,
    current: options.dataSource,
    scopedVars,
    onChange: async (ds: DataSourceInstanceSettings, defaultQueries?: DataQuery[] | GrafanaQuery[]) => {
      await onChange(ds, defaultQueries);
      setIsDataSourceModalOpen(false);
    },
  };

  return (
    <>
      {isDataSourceModalOpen && (
        <DataSourceModal {...commonProps} onDismiss={() => setIsDataSourceModalOpen(false)}></DataSourceModal>
      )}

      <DataSourcePicker {...commonProps} />
    </>
  );
}
