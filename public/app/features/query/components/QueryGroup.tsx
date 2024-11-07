import { css } from '@emotion/css';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import {
  CoreApp,
  DataSourceApi,
  DataSourceInstanceSettings,
  getDataSourceRef,
  getDefaultTimeRange,
  GrafanaTheme,
  LoadingState,
  PanelData,
  PluginType,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Button, CustomScrollbar, InlineFormLabel, Modal, Stack, useStyles } from '@grafana/ui';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';
import config from 'app/core/config';
import { addQuery, queryIsEmpty } from 'app/core/utils/query';
import { DataSourceModal } from 'app/features/datasources/components/picker/DataSourceModal';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { dataSource as expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { AngularDeprecationPluginNotice } from 'app/features/plugins/angularDeprecation/AngularDeprecationPluginNotice';
import { isSharedDashboardQuery } from 'app/plugins/datasource/dashboard';
import { GrafanaQuery } from 'app/plugins/datasource/grafana/types';
import { QueryGroupOptions } from 'app/types';

import { isAngularDatasourcePluginAndNotHidden } from '../../plugins/angularDeprecation/utils';
import { PanelQueryRunner } from '../state/PanelQueryRunner';
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

export const QueryGroup = memo(
  ({ queryRunner, options, onOpenQueryInspector, onRunQueries, onOptionsChange }: Props) => {
    const [dataSource, setDataSource] = useState<DataSourceApi>();
    const [dsSettings, setDsSettings] = useState<DataSourceInstanceSettings>();
    const [queries, setQueries] = useState<DataQuery[]>([]);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [defaultDataSource, setDefaultDataSource] = useState<DataSourceApi>();
    const [data, setData] = useState<PanelData>({
      state: LoadingState.NotStarted,
      series: [],
      timeRange: getDefaultTimeRange(),
    });
    const scrollElementRef = useRef<HTMLDivElement | null>(null);
    const styles = useStyles(getStyles);
    const dataSourceSrv = getDataSourceSrv();

    const setNewQueriesAndDatasource = useCallback(async (options: QueryGroupOptions) => {
      try {
        const ds = await dataSourceSrv.get(options.dataSource);
        const dsSettings = dataSourceSrv.getInstanceSettings(options.dataSource);
        const defaultDs = await dataSourceSrv.get();
        const datasource = ds.getRef();
        const newQueries = options.queries.map((q) => ({
          ...(queryIsEmpty(q) && ds?.getDefaultQuery?.(CoreApp.PanelEditor)),
          datasource,
          ...q,
        }));

        setQueries(newQueries);
        setDataSource(ds);
        setDsSettings(dsSettings);
        setDefaultDataSource(defaultDs);
      } catch (error) {
        console.error('failed to load data source', error);
      }
    }, []);

    useEffect(() => {
      const subscription = queryRunner.getData({ withTransforms: false, withFieldConfig: false }).subscribe({
        next: (data: PanelData) => setData(data),
      });

      setNewQueriesAndDatasource(options);

      return () => subscription.unsubscribe();
    }, [queryRunner, options, setNewQueriesAndDatasource]);

    useEffect(() => {
      const checkDataSource = async () => {
        const currentDS = await getDataSourceSrv().get(options.dataSource);
        if (dataSource && currentDS.uid !== dataSource.uid) {
          setNewQueriesAndDatasource(options);
        }
      };
      checkDataSource();
    }, [options, dataSource, setNewQueriesAndDatasource]);

    const onChange = useCallback(
      (changedProps: Partial<QueryGroupOptions>) => {
        onOptionsChange({
          ...options,
          ...changedProps,
        });
      },
      [options, onOptionsChange]
    );

    const onChangeDataSource = async (
      newSettings: DataSourceInstanceSettings,
      defaultQueries?: DataQuery[] | GrafanaQuery[]
    ) => {
      const currentDS = dsSettings ? await getDataSourceSrv().get(dsSettings.uid) : undefined;
      const nextDS = await getDataSourceSrv().get(newSettings.uid);
      const newQueries = defaultQueries || (await updateQueries(nextDS, newSettings.uid, queries, currentDS));
      const newDataSource = await dataSourceSrv.get(newSettings.name);

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

    const newQuery = useCallback(() => {
      const ds =
        dsSettings && !dsSettings.meta.mixed
          ? getDataSourceRef(dsSettings)
          : defaultDataSource
            ? defaultDataSource.getRef()
            : { type: undefined, uid: undefined };

      return {
        ...dataSource?.getDefaultQuery?.(CoreApp.PanelEditor),
        datasource: ds,
      };
    }, [dsSettings, defaultDataSource, dataSource]);

    const onQueriesChange = useCallback(
      (newQueries: DataQuery[] | GrafanaQuery[]) => {
        onChange({ queries: newQueries });
        setQueries(newQueries);
      },
      [onChange]
    );

    const onScrollBottom = useCallback(() => {
      setTimeout(() => {
        if (scrollElementRef.current) {
          scrollElementRef.current.scrollTo({ top: 10000 });
        }
      }, 20);
    }, []);

    const onAddQuery = useCallback(
      (query: Partial<DataQuery>) => {
        const dsRef = dsSettings ? getDataSourceRef(dsSettings) : { type: undefined, uid: undefined };
        onQueriesChange(addQuery(queries, query, dsRef));
        onScrollBottom();
      },
      [dsSettings, queries, onQueriesChange, onScrollBottom]
    );

    const onAddQueryClick = useCallback(() => {
      onQueriesChange(addQuery(queries, newQuery()));
      onScrollBottom();
    }, [queries, newQuery, onQueriesChange, onScrollBottom]);

    const onAddExpressionClick = useCallback(() => {
      onQueriesChange(addQuery(queries, expressionDatasource.newQuery()));
      onScrollBottom();
    }, [queries, onQueriesChange, onScrollBottom]);

    const onUpdateAndRun = useCallback(
      (options: QueryGroupOptions) => {
        onOptionsChange(options);
        onRunQueries();
      },
      [onOptionsChange, onRunQueries]
    );

    const isExpressionsSupported = (dsSettings: DataSourceInstanceSettings) => {
      return (dsSettings.meta.alerting || dsSettings.meta.mixed) === true;
    };

    const renderTopSection = () => {
      if (!dsSettings || !dataSource) {
        return null;
      }
      return (
        <QueryGroupTopSection
          data={data}
          dataSource={dataSource}
          options={options}
          dsSettings={dsSettings}
          onOptionsChange={onUpdateAndRun}
          onDataSourceChange={onChangeDataSource}
          onOpenQueryInspector={onOpenQueryInspector}
        />
      );
    };

    const renderExtraActions = () => {
      return GroupActionComponents.getAllExtraRenderAction()
        .map((action, index) =>
          action({
            onAddQuery,
            onChangeDataSource,
            key: index,
          })
        )
        .filter(Boolean);
    };

    return (
      <CustomScrollbar autoHeightMin="100%" scrollRefCallback={(el) => (scrollElementRef.current = el)}>
        <div className={styles.innerWrapper}>
          {renderTopSection()}
          {dsSettings && (
            <>
              <div className={styles.queriesWrapper}>
                <div aria-label={selectors.components.QueryTab.content}>
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
                    Add query
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
                    <span>Expression&nbsp;</span>
                  </Button>
                )}
                {renderExtraActions()}
              </Stack>
              {isHelpOpen && (
                <Modal title="Data source help" isOpen={true} onDismiss={() => setIsHelpOpen(false)}>
                  <PluginHelp pluginId={dsSettings.meta.id} />
                </Modal>
              )}
            </>
          )}
        </div>
      </CustomScrollbar>
    );
  }
);

QueryGroup.displayName = 'QueryGroup';

const getStyles = (theme: GrafanaTheme) => {
  return {
    innerWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing.md,
    }),
    dataSourceRow: css({
      display: 'flex',
      marginBottom: theme.spacing.md,
    }),
    dataSourceRowItem: css({
      marginRight: theme.spacing.inlineFormMargin,
    }),
    dataSourceRowItemOptions: css({
      flexGrow: 1,
      marginRight: theme.spacing.inlineFormMargin,
    }),
    queriesWrapper: css({
      paddingBottom: '16px',
    }),
    expressionWrapper: css({}),
    expressionButton: css({
      marginRight: theme.spacing.sm,
    }),
  };
};

interface QueryGroupTopSectionProps {
  data: PanelData;
  dataSource: DataSourceApi;
  dsSettings: DataSourceInstanceSettings;
  options: QueryGroupOptions;
  onOpenQueryInspector?: () => void;
  onOptionsChange?: (options: QueryGroupOptions) => void;
  onDataSourceChange?: (ds: DataSourceInstanceSettings, defaultQueries?: DataQuery[] | GrafanaQuery[]) => Promise<void>;
}

export function QueryGroupTopSection({
  dataSource,
  options,
  data,
  dsSettings,
  onDataSourceChange,
  onOptionsChange,
  onOpenQueryInspector,
}: QueryGroupTopSectionProps) {
  const styles = useStyles(getStyles);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  return (
    <>
      <div data-testid={selectors.components.QueryTab.queryGroupTopSection}>
        <div className={styles.dataSourceRow}>
          <InlineFormLabel htmlFor="data-source-picker" width={'auto'}>
            Data source
          </InlineFormLabel>
          <div className={styles.dataSourceRowItem}>
            <DataSourcePickerWithPrompt
              options={options}
              onChange={async (ds, defaultQueries) => {
                return onDataSourceChange?.(ds, defaultQueries);
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
                  title="Open data source help"
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
                    aria-label={selectors.components.QueryTab.queryInspectorButton}
                  >
                    Query inspector
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        {dataSource && isAngularDatasourcePluginAndNotHidden(dataSource.uid) && (
          <AngularDeprecationPluginNotice
            pluginId={dataSource.type}
            pluginType={PluginType.datasource}
            angularSupportEnabled={config?.angularSupportEnabled}
            showPluginDetailsLink={true}
            interactionElementId="datasource-query"
          />
        )}
      </div>
      {isHelpOpen && (
        <Modal title="Data source help" isOpen={true} onDismiss={() => setIsHelpOpen(false)}>
          <PluginHelp pluginId={dsSettings.meta.id} />
        </Modal>
      )}
    </>
  );
}

interface DataSourcePickerWithPromptProps {
  isDataSourceModalOpen?: boolean;
  options: QueryGroupOptions;
  onChange: (ds: DataSourceInstanceSettings, defaultQueries?: DataQuery[] | GrafanaQuery[]) => Promise<void>;
}

function DataSourcePickerWithPrompt({ options, onChange, ...otherProps }: DataSourcePickerWithPromptProps) {
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
    uploadFile: true,
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
