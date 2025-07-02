import { css } from '@emotion/css';
import { useState, useEffect } from 'react';

import {
  GrafanaTheme2,
  DataSourceInstanceSettings,
  SelectableValue,
  PanelPlugin,
  LoadingState,
  dateTime,
  FieldType,
  createDataFrame,
  DataQueryResponse,
  EventBusSrv,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Select, useStyles2, Spinner, Alert } from '@grafana/ui';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { loadPanelPlugin } from 'app/features/plugins/admin/state/actions';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { useDispatch } from 'app/types';

import { getUpgradesAPI } from './api';

interface DashboardPanelResult {
  dashboardUID: string;
  panelID: number;
  panelJSON: string;
  panelObject: object;
}

interface DataSourceOption {
  label: string;
  value: string;
  description?: string;
}

// Simple panel renderer that doesn't require Redux panel state
function SimplePanelRenderer({
  panel,
  width = 400,
  height = 300,
}: {
  panel: PanelModel;
  width?: number;
  height?: number;
}) {
  const [plugin, setPlugin] = useState<PanelPlugin | null>(null);
  const [panelData, setPanelData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const dispatch = useDispatch();

  useEffect(() => {
    const loadPluginAndData = async () => {
      try {
        setLoading(true);

        // Load the panel plugin
        const loadedPlugin = await dispatch(loadPanelPlugin(panel.type));
        setPlugin(loadedPlugin);
        await panel.pluginLoaded(loadedPlugin);

        // Execute the actual query from the panel configuration
        await executeQuery();
      } catch (err) {
        console.error('Failed to load panel plugin or execute query:', err);
        setError(`Failed to load ${panel.type} plugin: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    const executeQuery = async () => {
      try {
        const panelOptions = panel.getOptions();
        console.log('Panel options:', panelOptions);
        console.log('Panel targets:', panel.targets);
        console.log('Panel datasource:', panel.datasource);

        // Get the datasource
        const datasourceService = getDatasourceSrv();
        const datasource = await datasourceService.get(panel.datasource);

        // Create time range for last 30 seconds
        const now = Date.now();
        const timeRange = {
          from: dateTime(now - 30000),
          to: dateTime(now),
          raw: { from: 'now-30s', to: 'now' },
        };

        // Create query request
        const queryRequest = {
          app: 'dashboard',
          requestId: `panel-${panel.id}-${Date.now()}`,
          timezone: 'browser',
          panelId: panel.id,
          range: timeRange,
          interval: '1s',
          intervalMs: 1000,
          targets: panel.targets.map((target) => ({
            ...target,
            datasource: panel.datasource,
          })),
          maxDataPoints: 300,
          scopedVars: {},
          startTime: Date.now(),
        };

        console.log('Executing query:', queryRequest);

        // Execute the query - datasource.query can return Promise or Observable
        const queryResponse = datasource.query(queryRequest);

        // Handle both Promise and Observable
        let queryResult: DataQueryResponse;
        if ('subscribe' in queryResponse) {
          // It's an Observable
          queryResult = await new Promise<DataQueryResponse>((resolve, reject) => {
            queryResponse.subscribe({
              next: (result: DataQueryResponse) => {
                console.log('Query result:', result);
                resolve(result);
              },
              error: (err: any) => reject(err),
            });
          });
        } else {
          // It's a Promise
          queryResult = await queryResponse;
          console.log('Query result:', queryResult);
        }

        // Apply field config to maintain styling (colors, etc.)
        const processedSeries = (queryResult.data || []).map((series: any) => {
          // Apply field config overrides and defaults
          if (panel.fieldConfig) {
            series.fields = series.fields?.map((field: any) => {
              // Apply default field config
              if (panel.fieldConfig.defaults) {
                field.config = { ...panel.fieldConfig.defaults, ...field.config };
              }
              return field;
            });
          }
          return series;
        });

        setPanelData({
          state: LoadingState.Done,
          series: processedSeries,
          timeRange,
        });
      } catch (queryError) {
        console.error('Query execution failed:', queryError);

        // Fall back to sample data if query fails
        console.log('Falling back to sample data...');
        createSampleData();
      }
    };

    const createSampleData = () => {
      // Generate sample data as fallback
      const now = Date.now();
      const timeRange = {
        from: dateTime(now - 30000),
        to: dateTime(now),
        raw: { from: 'now-30s', to: 'now' },
      };

      const dataPoints = [];
      const valuePoints = [];
      for (let i = 0; i < 30; i++) {
        const timestamp = now - (30 - i) * 1000;
        dataPoints.push(timestamp);
        valuePoints.push(Math.random() * 100 + 50);
      }

      const series = [
        createDataFrame({
          name: panel.title || 'Sample Data',
          fields: [
            {
              name: 'Time',
              type: FieldType.time,
              values: dataPoints,
            },
            {
              name: 'Value',
              type: FieldType.number,
              values: valuePoints,
            },
          ],
        }),
      ];

      setPanelData({
        state: LoadingState.Done,
        series,
        timeRange,
      });
    };

    loadPluginAndData();
  }, [panel.type, dispatch, panel]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width, height }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !plugin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width, height, padding: 16 }}>
        <Alert title={t('plugin-panels.panel.error', 'Panel Error')} severity="error">
          {error || t('plugin-panels.panel.plugin-not-found', 'Plugin not found')}
        </Alert>
      </div>
    );
  }

  const PanelComponent = plugin.panel;

  if (!PanelComponent) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width, height, padding: 16 }}>
        <Alert title={t('plugin-panels.panel.error', 'Panel Error')} severity="error">
          {t('plugin-panels.panel.no-component', 'Panel component not found')}
        </Alert>
      </div>
    );
  }

  if (!panelData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width, height }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div style={{ width, height, position: 'relative', overflow: 'hidden' }}>
      <PanelComponent
        id={panel.id}
        data={panelData}
        title={panel.title}
        timeRange={panelData.timeRange}
        timeZone="browser"
        options={panel.getOptions()}
        fieldConfig={panel.fieldConfig}
        transparent={panel.transparent}
        width={width}
        height={height}
        renderCounter={1}
        replaceVariables={(str: string) => str}
        onOptionsChange={() => {}}
        onFieldConfigChange={() => {}}
        onChangeTimeRange={() => {}}
        eventBus={new EventBusSrv()}
      />
    </div>
  );
}

function PluginPanels() {
  const styles = useStyles2(getStyles);
  const [dataSources, setDataSources] = useState<DataSourceOption[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<string>('');
  const [panels, setPanels] = useState<DashboardPanelResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Create a minimal dashboard model for the panels
  const dashboard = new DashboardModel({
    title: t('plugin-panels.dashboard.title', 'Plugin Panels Preview'),
    panels: [],
    time: { from: 'now-30s', to: 'now' }, // Last 30 seconds
    timezone: 'browser',
    schemaVersion: 30,
    version: 1,
    editable: false,
    graphTooltip: 0,
  });

  useEffect(() => {
    // Load available data sources
    const loadDataSources = () => {
      try {
        const dsService = getDatasourceSrv();
        const dsList = dsService.getList({ metrics: true });

        const options: DataSourceOption[] = dsList.map((ds: DataSourceInstanceSettings) => ({
          label: `${ds.name} (${ds.type})`,
          value: ds.uid,
          description: ds.type,
        }));

        setDataSources(options);

        // Auto-select first data source if available
        if (options.length > 0) {
          setSelectedDataSource(options[0].value);
        }
      } catch (err) {
        console.error('Failed to load data sources:', err);
        setError(t('plugin-panels.errors.load-datasources', 'Failed to load data sources'));
      }
    };

    loadDataSources();
  }, []);

  useEffect(() => {
    // Load panels when data source changes
    if (selectedDataSource) {
      loadPanelsForDataSource(selectedDataSource);
    }
  }, [selectedDataSource]);

  const loadPanelsForDataSource = async (dsUID: string) => {
    setLoading(true);
    setError('');
    setPanels([]);

    try {
      const api = getUpgradesAPI();
      const result = await api.getDashboardPanelsForDataSource(dsUID);
      setPanels(result);
    } catch (err) {
      console.error('Failed to load panels:', err);
      setError(
        t('plugin-panels.errors.load-panels', 'Failed to load panels: {{error}}', {
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDataSourceChange = (value: SelectableValue<string>) => {
    if (value?.value) {
      setSelectedDataSource(value.value);
    }
  };

  const createPanelModel = (panelResult: DashboardPanelResult): PanelModel => {
    // Create a PanelModel from the panel JSON
    const panelData = {
      ...panelResult.panelObject,
      id: panelResult.panelID,
      // Override time range to last 30 seconds
      timeFrom: 'now-30s',
      timeShift: null,
      hideTimeOverride: false,
    };

    console.log(panelData);
    return new PanelModel(panelData);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>
          <Trans i18nKey="plugin-panels.title">Plugin Panels</Trans>
        </h3>
        <p>
          <Trans i18nKey="plugin-panels.description">Select a data source to view panels that use it</Trans>
        </p>
      </div>

      <div className={styles.controls}>
        <Select
          label={t('plugin-panels.datasource.label', 'Data Source')}
          value={selectedDataSource}
          onChange={handleDataSourceChange}
          options={dataSources}
          placeholder={t('plugin-panels.datasource.placeholder', 'Select a data source...')}
          width={40}
        />
      </div>

      {loading && (
        <div className={styles.loading}>
          <Spinner size="lg" />
          <span>
            <Trans i18nKey="plugin-panels.loading">Loading panels...</Trans>
          </span>
        </div>
      )}

      {error && (
        <Alert title={t('plugin-panels.error.title', 'Error')} severity="error">
          {error}
        </Alert>
      )}

      {!loading && !error && panels.length === 0 && selectedDataSource && (
        <Alert title={t('plugin-panels.no-panels.title', 'No panels found')} severity="info">
          <Trans i18nKey="plugin-panels.no-panels.description">
            No panels found that use the selected data source.
          </Trans>
        </Alert>
      )}

      {!loading && panels.length > 0 && (
        <div className={styles.panelsGrid}>
          {panels.map((panelResult, index) => {
            const panelModel = createPanelModel(panelResult);
            const stateKey = `panel-${panelResult.dashboardUID}-${panelResult.panelID}`;

            return (
              <div key={stateKey} className={styles.panelWrapper}>
                <div className={styles.panelHeader}>
                  <h4>{panelModel.title || `Panel ${panelResult.panelID}`}</h4>
                  <div className={styles.dashboardInfo}>
                    <span>
                      <Trans i18nKey="plugin-panels.panel.dashboard-prefix">Dashboard:</Trans>{' '}
                    </span>
                    <a
                      href={`/d/${panelResult.dashboardUID}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.dashboardLink}
                    >
                      {panelResult.dashboardUID}
                    </a>
                  </div>
                </div>
                <div className={styles.panelContent}>
                  <SimplePanelRenderer panel={panelModel} width={400} height={300} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    padding: theme.spacing(3),
    maxWidth: '100%',
  }),

  header: css({
    marginBottom: theme.spacing(3),

    h3: {
      margin: 0,
      marginBottom: theme.spacing(1),
      color: theme.colors.text.primary,
    },

    p: {
      margin: 0,
      color: theme.colors.text.secondary,
    },
  }),

  controls: css({
    marginBottom: theme.spacing(3),
    display: 'flex',
    gap: theme.spacing(2),
    alignItems: 'end',
  }),

  loading: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(4),
    justifyContent: 'center',
    color: theme.colors.text.secondary,
  }),

  panelsGrid: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))',
    gap: theme.spacing(3),
    marginTop: theme.spacing(3),
    width: '100%',
  }),

  panelWrapper: css({
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.background.primary,
    overflow: 'hidden',
  }),

  panelHeader: css({
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.secondary,

    h4: {
      margin: 0,
      marginBottom: theme.spacing(0.5),
      color: theme.colors.text.primary,
      fontSize: theme.typography.h5.fontSize,
    },
  }),

  dashboardInfo: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    display: 'flex',
    alignItems: 'center',
  }),

  dashboardLink: css({
    color: theme.colors.text.link,
    textDecoration: 'none',
    fontFamily: 'monospace',
    fontSize: theme.typography.bodySmall.fontSize,

    '&:hover': {
      textDecoration: 'underline',
      color: theme.colors.text.primary,
    },
  }),

  panelContent: css({
    position: 'relative',
    height: '300px',
    width: '100%',
    overflow: 'hidden',

    // Ensure panel takes full width
    '& > div': {
      width: '100% !important',
      height: '100% !important',
    },
  }),
});

export default PluginPanels;
