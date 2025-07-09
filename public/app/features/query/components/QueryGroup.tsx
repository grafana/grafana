import { css } from '@emotion/css';
import { PureComponent, useEffect, useState } from 'react';
import * as React from 'react';
import { Unsubscribable } from 'rxjs';

import {
  CoreApp,
  DataSourceApi,
  DataSourceInstanceSettings,
  getDataSourceRef,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Button, HorizontalGroup, InlineFormLabel, Modal, ScrollContainer, stylesFactory } from '@grafana/ui';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';
import config from 'app/core/config';
import { backendSrv } from 'app/core/services/backend_srv';
import { addQuery, queryIsEmpty } from 'app/core/utils/query';
import { DataSourceModal } from 'app/features/datasources/components/picker/DataSourceModal';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { dataSource as expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { isSharedDashboardQuery } from 'app/plugins/datasource/dashboard/runSharedRequest';
import { GrafanaQuery } from 'app/plugins/datasource/grafana/types';
import { QueryGroupOptions } from 'app/types/query';

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

interface State {
  dataSource?: DataSourceApi;
  dsSettings?: DataSourceInstanceSettings;
  queries: DataQuery[];
  helpContent: React.ReactNode;
  isLoadingHelp: boolean;
  isPickerOpen: boolean;
  isDataSourceModalOpen: boolean;
  data: PanelData;
  isHelpOpen: boolean;
  defaultDataSource?: DataSourceApi;
  scrollElement?: HTMLDivElement;
}

export class QueryGroup extends PureComponent<Props, State> {
  backendSrv = backendSrv;
  dataSourceSrv = getDataSourceSrv();
  querySubscription: Unsubscribable | null = null;

  state: State = {
    isDataSourceModalOpen: !!locationService.getSearchObject().firstPanel,
    isLoadingHelp: false,
    helpContent: null,
    isPickerOpen: false,
    isHelpOpen: false,
    queries: [],
    data: {
      state: LoadingState.NotStarted,
      series: [],
      timeRange: getDefaultTimeRange(),
    },
  };

  async componentDidMount() {
    const { options, queryRunner } = this.props;

    this.querySubscription = queryRunner.getData({ withTransforms: false, withFieldConfig: false }).subscribe({
      next: (data: PanelData) => this.onPanelDataUpdate(data),
    });

    this.setNewQueriesAndDatasource(options);
  }

  componentWillUnmount() {
    if (this.querySubscription) {
      this.querySubscription.unsubscribe();
      this.querySubscription = null;
    }
  }

  async componentDidUpdate() {
    const { options } = this.props;

    const currentDS = await getDataSourceSrv().get(options.dataSource);
    if (this.state.dataSource && currentDS.uid !== this.state.dataSource?.uid) {
      this.setNewQueriesAndDatasource(options);
    }
  }

  async setNewQueriesAndDatasource(options: QueryGroupOptions) {
    try {
      const ds = await this.dataSourceSrv.get(options.dataSource);
      const dsSettings = this.dataSourceSrv.getInstanceSettings(options.dataSource);

      const defaultDataSource = await this.dataSourceSrv.get();
      const datasource = ds.getRef();
      const queries = options.queries.map((q) => ({
        ...(queryIsEmpty(q) && ds?.getDefaultQuery?.(CoreApp.PanelEditor)),
        datasource,
        ...q,
      }));

      this.setState({
        queries,
        dataSource: ds,
        dsSettings,
        defaultDataSource,
      });
    } catch (error) {
      console.error('failed to load data source', error);
    }
  }

  onPanelDataUpdate(data: PanelData) {
    this.setState({ data });
  }

  onChangeDataSource = async (
    newSettings: DataSourceInstanceSettings,
    defaultQueries?: DataQuery[] | GrafanaQuery[]
  ) => {
    const { dsSettings } = this.state;
    const currentDS = dsSettings ? await getDataSourceSrv().get(dsSettings.uid) : undefined;
    const nextDS = await getDataSourceSrv().get(newSettings.uid);

    // We need to pass in newSettings.uid as well here as that can be a variable expression and we want to store that in the query model not the current ds variable value
    const queries = defaultQueries || (await updateQueries(nextDS, newSettings.uid, this.state.queries, currentDS));

    const dataSource = await this.dataSourceSrv.get(newSettings.name);

    this.onChange({
      queries,
      dataSource: {
        name: newSettings.name,
        uid: newSettings.uid,
        ...getDataSourceRef(newSettings),
      },
    });

    this.setState({
      queries,
      dataSource: dataSource,
      dsSettings: newSettings,
    });

    if (defaultQueries) {
      this.props.onRunQueries();
    }
  };

  onAddQueryClick = () => {
    const { queries } = this.state;
    this.onQueriesChange(addQuery(queries, this.newQuery()));
    this.onScrollBottom();
  };

  newQuery(): Partial<DataQuery> {
    const { dsSettings, defaultDataSource } = this.state;

    const ds =
      dsSettings && !dsSettings.meta.mixed
        ? getDataSourceRef(dsSettings)
        : defaultDataSource
          ? defaultDataSource.getRef()
          : { type: undefined, uid: undefined };

    return {
      ...this.state.dataSource?.getDefaultQuery?.(CoreApp.PanelEditor),
      datasource: ds,
    };
  }

  onChange(changedProps: Partial<QueryGroupOptions>) {
    this.props.onOptionsChange({
      ...this.props.options,
      ...changedProps,
    });
  }

  onAddExpressionClick = () => {
    this.onQueriesChange(addQuery(this.state.queries, expressionDatasource.newQuery()));
    this.onScrollBottom();
  };

  onScrollBottom = () => {
    setTimeout(() => {
      if (this.state.scrollElement) {
        this.state.scrollElement.scrollTo({ top: 10000 });
      }
    }, 20);
  };

  onUpdateAndRun = (options: QueryGroupOptions) => {
    this.props.onOptionsChange(options);
    this.props.onRunQueries();
  };

  renderTopSection(styles: QueriesTabStyles) {
    const { onOpenQueryInspector, options } = this.props;
    const { dataSource, data, dsSettings } = this.state;

    if (!dsSettings || !dataSource) {
      return null;
    }
    return (
      <QueryGroupTopSection
        data={data}
        dataSource={dataSource}
        options={options}
        dsSettings={dsSettings}
        onOptionsChange={this.onUpdateAndRun}
        onDataSourceChange={this.onChangeDataSource}
        onOpenQueryInspector={onOpenQueryInspector}
      />
    );
  }

  onOpenHelp = () => {
    this.setState({ isHelpOpen: true });
  };

  onCloseHelp = () => {
    this.setState({ isHelpOpen: false });
  };

  onCloseDataSourceModal = () => {
    this.setState({ isDataSourceModalOpen: false });
  };

  onAddQuery = (query: Partial<DataQuery>) => {
    const { dsSettings, queries } = this.state;
    this.onQueriesChange(
      addQuery(queries, query, dsSettings ? getDataSourceRef(dsSettings) : { type: undefined, uid: undefined })
    );
    this.onScrollBottom();
  };

  onQueriesChange = (queries: DataQuery[] | GrafanaQuery[]) => {
    this.onChange({ queries });
    this.setState({ queries });
  };

  renderQueries(dsSettings: DataSourceInstanceSettings) {
    const { onRunQueries } = this.props;
    const { data, queries } = this.state;

    return (
      <div aria-label={selectors.components.QueryTab.content}>
        <QueryEditorRows
          queries={queries}
          dsSettings={dsSettings}
          onQueriesChange={this.onQueriesChange}
          onAddQuery={this.onAddQuery}
          onRunQueries={onRunQueries}
          data={data}
        />
      </div>
    );
  }

  isExpressionsSupported(dsSettings: DataSourceInstanceSettings): boolean {
    return (dsSettings.meta.backend || dsSettings.meta.alerting || dsSettings.meta.mixed) === true;
  }

  renderExtraActions() {
    return GroupActionComponents.getAllExtraRenderAction()
      .map((action, index) =>
        action({
          onAddQuery: this.onAddQuery,
          onChangeDataSource: this.onChangeDataSource,
          key: index,
        })
      )
      .filter(Boolean);
  }

  renderAddQueryRow(dsSettings: DataSourceInstanceSettings, styles: QueriesTabStyles) {
    const showAddButton = !isSharedDashboardQuery(dsSettings.name);

    return (
      <HorizontalGroup spacing="md" align="flex-start">
        {showAddButton && (
          <Button
            icon="plus"
            onClick={this.onAddQueryClick}
            variant="secondary"
            data-testid={selectors.components.QueryTab.addQuery}
          >
            <Trans i18nKey="query.query-group.add-query">Add query</Trans>
          </Button>
        )}
        {config.expressionsEnabled && this.isExpressionsSupported(dsSettings) && (
          <Button
            icon="plus"
            onClick={this.onAddExpressionClick}
            variant="secondary"
            className={styles.expressionButton}
            data-testid="query-tab-add-expression"
          >
            <span>
              <Trans i18nKey="query.query-group.expression">Expression</Trans>
            </span>
          </Button>
        )}
        {this.renderExtraActions()}
      </HorizontalGroup>
    );
  }

  setScrollRef = (scrollElement: HTMLDivElement): void => {
    this.setState({ scrollElement });
  };

  render() {
    const { isHelpOpen, dsSettings } = this.state;
    const styles = getStyles();

    return (
      <ScrollContainer minHeight="100%" ref={this.setScrollRef}>
        <div className={styles.innerWrapper}>
          {this.renderTopSection(styles)}
          {dsSettings && (
            <>
              <div className={styles.queriesWrapper}>{this.renderQueries(dsSettings)}</div>
              {this.renderAddQueryRow(dsSettings, styles)}
              {isHelpOpen && (
                <Modal
                  title={t('query.query-group.title-data-source-help', 'Data source help')}
                  isOpen={true}
                  onDismiss={this.onCloseHelp}
                >
                  <PluginHelp pluginId={dsSettings.meta.id} />
                </Modal>
              )}
            </>
          )}
        </div>
      </ScrollContainer>
    );
  }
}

const getStyles = stylesFactory(() => {
  const { theme } = config;

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
});

type QueriesTabStyles = ReturnType<typeof getStyles>;

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
  const styles = getStyles();
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
                  title={t(
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
                    aria-label={selectors.components.QueryTab.queryInspectorButton}
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
