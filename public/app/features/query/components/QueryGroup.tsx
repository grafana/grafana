import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { DropEvent, FileRejection } from 'react-dropzone';
import { Unsubscribable } from 'rxjs';

import {
  CoreApp,
  DataFrameJSON,
  dataFrameToJSON,
  DataQuery,
  DataSourceApi,
  DataSourceInstanceSettings,
  getDefaultTimeRange,
  LoadingState,
  PanelData,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceSrv } from '@grafana/runtime';
import { Button, CustomScrollbar, HorizontalGroup, InlineFormLabel, Modal, stylesFactory } from '@grafana/ui';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';
import config from 'app/core/config';
import { backendSrv } from 'app/core/services/backend_srv';
import { addQuery, queryIsEmpty } from 'app/core/utils/query';
import * as DFImport from 'app/features/dataframe-import';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { dataSource as expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { DashboardQueryEditor, isSharedDashboardQuery } from 'app/plugins/datasource/dashboard';
import { GrafanaQuery, GrafanaQueryType } from 'app/plugins/datasource/grafana/types';
import { QueryGroupDataSource, QueryGroupOptions } from 'app/types';

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
  isAddingMixed: boolean;
  data: PanelData;
  isHelpOpen: boolean;
  defaultDataSource?: DataSourceApi;
  scrollElement?: HTMLDivElement;
  savedQueryUid?: string | null;
  initialState: {
    queries: DataQuery[];
    dataSource?: QueryGroupDataSource;
    savedQueryUid?: string | null;
  };
}

export class QueryGroup extends PureComponent<Props, State> {
  backendSrv = backendSrv;
  dataSourceSrv = getDataSourceSrv();
  querySubscription: Unsubscribable | null = null;

  state: State = {
    isLoadingHelp: false,
    helpContent: null,
    isPickerOpen: false,
    isAddingMixed: false,
    isHelpOpen: false,
    queries: [],
    savedQueryUid: null,
    initialState: {
      queries: [],
      savedQueryUid: null,
    },
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
        savedQueryUid: options.savedQueryUid,
        initialState: {
          queries: options.queries.map((q) => ({ ...q })),
          dataSource: { ...options.dataSource },
          savedQueryUid: options.savedQueryUid,
        },
      });
    } catch (error) {
      console.log('failed to load data source', error);
    }
  }

  componentWillUnmount() {
    if (this.querySubscription) {
      this.querySubscription.unsubscribe();
      this.querySubscription = null;
    }
  }

  onPanelDataUpdate(data: PanelData) {
    this.setState({
      queries: this.props.options.queries,
      data,
    });
  }

  onChangeDataSource = async (newSettings: DataSourceInstanceSettings) => {
    const { dsSettings } = this.state;
    const currentDS = dsSettings ? await getDataSourceSrv().get(dsSettings.uid) : undefined;
    const nextDS = await getDataSourceSrv().get(newSettings.uid);

    // We need to pass in newSettings.uid as well here as that can be a variable expression and we want to store that in the query model not the current ds variable value
    const queries = await updateQueries(nextDS, newSettings.uid, this.state.queries, currentDS);

    const dataSource = await this.dataSourceSrv.get(newSettings.name);
    this.onChange({
      queries,
      savedQueryUid: null,
      dataSource: {
        name: newSettings.name,
        uid: newSettings.uid,
        type: newSettings.meta.id,
        default: newSettings.isDefault,
      },
    });

    this.setState({
      queries,
      savedQueryUid: null,
      dataSource: dataSource,
      dsSettings: newSettings,
    });
  };

  onAddQueryClick = () => {
    const { queries } = this.state;
    this.onQueriesChange(addQuery(queries, this.newQuery()));
    this.onScrollBottom();
  };

  newQuery(): Partial<DataQuery> {
    const { dsSettings, defaultDataSource } = this.state;

    const ds = !dsSettings?.meta.mixed ? dsSettings : defaultDataSource;

    return {
      ...this.state.dataSource?.getDefaultQuery?.(CoreApp.PanelEditor),
      datasource: { uid: ds?.uid, type: ds?.type },
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
    const { dataSource, data } = this.state;

    return (
      <div>
        <div className={styles.dataSourceRow}>
          <InlineFormLabel htmlFor="data-source-picker" width={'auto'}>
            Data source
          </InlineFormLabel>
          <div className={styles.dataSourceRowItem}>
            <DataSourcePicker
              onChange={this.onChangeDataSource}
              current={options.dataSource}
              metrics={true}
              mixed={true}
              dashboard={true}
              variables={true}
              enableFileUpload={config.featureToggles.editPanelCSVDragAndDrop}
              fileUploadOptions={{
                onDrop: this.onFileDrop,
                maxSize: DFImport.maxFileSize,
                multiple: false,
                accept: DFImport.acceptedFiles,
              }}
              onClickAddCSV={this.onClickAddCSV}
            />
          </div>
          {dataSource && (
            <>
              <div className={styles.dataSourceRowItem}>
                <Button
                  variant="secondary"
                  icon="question-circle"
                  title="Open data source help"
                  onClick={this.onOpenHelp}
                  data-testid="query-tab-help-button"
                />
              </div>
              <div className={styles.dataSourceRowItemOptions}>
                <QueryGroupOptionsEditor
                  options={options}
                  dataSource={dataSource}
                  data={data}
                  onChange={this.onUpdateAndRun}
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
      </div>
    );
  }

  onOpenHelp = () => {
    this.setState({ isHelpOpen: true });
  };

  onCloseHelp = () => {
    this.setState({ isHelpOpen: false });
  };

  renderMixedPicker = () => {
    return (
      <DataSourcePicker
        mixed={false}
        onChange={this.onAddMixedQuery}
        current={null}
        autoFocus={true}
        variables={true}
        onBlur={this.onMixedPickerBlur}
        openMenuOnFocus={true}
      />
    );
  };

  onAddMixedQuery = (datasource: any) => {
    this.onAddQuery({ datasource: datasource.name });
    this.setState({ isAddingMixed: false });
  };

  onMixedPickerBlur = () => {
    this.setState({ isAddingMixed: false });
  };

  onAddQuery = (query: Partial<DataQuery>) => {
    const { dsSettings, queries } = this.state;
    this.onQueriesChange(addQuery(queries, query, { type: dsSettings?.type, uid: dsSettings?.uid }));
    this.onScrollBottom();
  };

  onClickAddCSV = async () => {
    const ds = getDataSourceSrv().getInstanceSettings('-- Grafana --');
    await this.onChangeDataSource(ds!);

    this.onQueriesChange([
      {
        refId: 'A',
        datasource: {
          type: 'grafana',
          uid: 'grafana',
        },
        queryType: GrafanaQueryType.Snapshot,
        snapshot: [],
      },
    ]);
    this.props.onRunQueries();
  };

  onFileDrop = (acceptedFiles: File[], fileRejections: FileRejection[], event: DropEvent) => {
    DFImport.filesToDataframes(acceptedFiles).subscribe(async (next) => {
      const snapshot: DataFrameJSON[] = [];
      next.dataFrames.forEach((df) => {
        const dataframeJson = dataFrameToJSON(df);
        snapshot.push(dataframeJson);
      });
      const ds = getDataSourceSrv().getInstanceSettings('-- Grafana --');
      await this.onChangeDataSource(ds!);
      this.onQueriesChange([
        {
          refId: 'A',
          datasource: {
            type: 'grafana',
            uid: 'grafana',
          },
          queryType: GrafanaQueryType.Snapshot,
          snapshot: snapshot,
          file: next.file,
        },
      ]);
      this.props.onRunQueries();
    });
  };

  onQueriesChange = (queries: DataQuery[] | GrafanaQuery[]) => {
    this.onChange({ queries });
    this.setState({ queries });
  };

  renderQueries(dsSettings: DataSourceInstanceSettings) {
    const { onRunQueries } = this.props;
    const { data, queries } = this.state;
    if (isSharedDashboardQuery(dsSettings.name)) {
      return (
        <DashboardQueryEditor
          queries={queries}
          panelData={data}
          onChange={this.onQueriesChange}
          onRunQueries={onRunQueries}
        />
      );
    }

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
    return (dsSettings.meta.alerting || dsSettings.meta.mixed) === true;
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
    const { isAddingMixed } = this.state;
    const showAddButton = !(isAddingMixed || isSharedDashboardQuery(dsSettings.name));

    return (
      <HorizontalGroup spacing="md" align="flex-start">
        {showAddButton && (
          <Button
            icon="plus"
            onClick={this.onAddQueryClick}
            variant="secondary"
            aria-label={selectors.components.QueryTab.addQuery}
            data-testid="query-tab-add-query"
          >
            Query
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
            <span>Expression&nbsp;</span>
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
      <CustomScrollbar autoHeightMin="100%" scrollRefCallback={this.setScrollRef}>
        <div className={styles.innerWrapper}>
          {this.renderTopSection(styles)}
          {dsSettings && (
            <>
              <div className={styles.queriesWrapper}>{this.renderQueries(dsSettings)}</div>
              {this.renderAddQueryRow(dsSettings, styles)}
              {isHelpOpen && (
                <Modal title="Data source help" isOpen={true} onDismiss={this.onCloseHelp}>
                  <PluginHelp pluginId={dsSettings.meta.id} />
                </Modal>
              )}
            </>
          )}
        </div>
      </CustomScrollbar>
    );
  }
}

const getStyles = stylesFactory(() => {
  const { theme } = config;

  return {
    innerWrapper: css`
      display: flex;
      flex-direction: column;
      padding: ${theme.spacing.md};
    `,
    dataSourceRow: css`
      display: flex;
      margin-bottom: ${theme.spacing.md};
    `,
    dataSourceRowItem: css`
      margin-right: ${theme.spacing.inlineFormMargin};
    `,
    dataSourceRowItemOptions: css`
      flex-grow: 1;
      margin-right: ${theme.spacing.inlineFormMargin};
    `,
    queriesWrapper: css`
      padding-bottom: 16px;
    `,
    expressionWrapper: css``,
    expressionButton: css`
      margin-right: ${theme.spacing.sm};
    `,
  };
});

type QueriesTabStyles = ReturnType<typeof getStyles>;
