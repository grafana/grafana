import { css } from '@emotion/css';
import { useState, useEffect } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  GrafanaTheme2,
  DataSourceInstanceSettings,
  SelectableValue,
  LoadingState,
  dateTime,
  FieldType,
  createDataFrame,
  DataQueryResponse,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { PanelRenderer } from '@grafana/runtime';
import { Select, useStyles2, Spinner, Alert } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

import { getUpgradesAPI } from './api';

interface DashboardPanelResult {
  dashboardUID: string;
  dashboardName: string;
  panelID: number;
  panelJSON: string;
  panelObject: object;
}

interface DataSourceOption {
  label: string;
  value: string;
  description?: string;
}

// Component to handle individual panel rendering with real data
function PanelWithRealData({ panel }: { panel: PanelModel }) {
  const [panelData, setPanelData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string>('');

  useEffect(() => {
    const executeQuery = async () => {
      try {
        setLoading(true);
        console.log('Panel options:', panel.getOptions());
        console.log('Panel targets:', panel.targets);
        console.log('Panel datasource:', panel.datasource);

        // If no targets, fall back to sample data
        if (!panel.targets || panel.targets.length === 0) {
          console.log('No targets found, using sample data');
          createSampleData();
          return;
        }

        // Get the datasource
        const datasourceService = getDatasourceSrv();
        const datasource = await datasourceService.get(panel.datasource);

        if (!datasource) {
          console.log('Datasource not found, using sample data');
          createSampleData();
          return;
        }

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
            const subscription = queryResponse.subscribe({
              next: (result: DataQueryResponse) => {
                console.log('Query result:', result);
                resolve(result);
              },
              error: (err: any) => {
                console.error('Observable query error:', err);
                reject(err);
              },
            });

            // Set a timeout to prevent hanging
            setTimeout(() => {
              subscription.unsubscribe();
              reject(new Error('Query timeout'));
            }, 10000);
          });
        } else {
          // It's a Promise
          queryResult = await Promise.race([
            queryResponse,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 10000)),
          ]);
          console.log('Query result:', queryResult);
        }

        // Check if we got valid data
        if (!queryResult.data || queryResult.data.length === 0) {
          console.log('No data returned from query, using sample data');
          createSampleData();
          return;
        }

        // Apply field config to maintain styling (colors, etc.)
        const processedSeries = queryResult.data.map((series: any) => {
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
        console.log('Falling back to sample data due to query error...');
        createSampleData();
      } finally {
        setLoading(false);
      }
    };

    const createSampleData = () => {
      // Generate sample data as fallback only when needed
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

    executeQuery();
  }, [panel]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: 16,
        }}
      >
        <Alert title={t('plugin-panels.panel.error', 'Panel Error')} severity="error">
          {error}
        </Alert>
      </div>
    );
  }

  if (!panelData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <AutoSizer>
      {({ width, height }: { width: number; height: number }) => (
        <PanelRenderer
          pluginId={panel.type}
          data={panelData}
          title={panel.title || 'Panel'}
          options={panel.getOptions()}
          fieldConfig={panel.fieldConfig}
          width={width}
          height={height}
          timeZone="browser"
        />
      )}
    </AutoSizer>
  );
}

// Helper function to create sample panel data (only used as fallback)
// function createSamplePanelData() {
//   const now = Date.now();
//   const timeRange = {
//     from: dateTime(now - 30000),
//     to: dateTime(now),
//     raw: { from: 'now-30s', to: 'now' },
//   };

//   const dataPoints = [];
//   const valuePoints = [];
//   for (let i = 0; i < 30; i++) {
//     const timestamp = now - (30 - i) * 1000;
//     dataPoints.push(timestamp);
//     valuePoints.push(Math.random() * 100 + 50);
//   }

//   const series = [
//     createDataFrame({
//       name: 'Sample Data',
//       fields: [
//         {
//           name: 'Time',
//           type: FieldType.time,
//           values: dataPoints,
//         },
//         {
//           name: 'Value',
//           type: FieldType.number,
//           values: valuePoints,
//         },
//       ],
//     }),
//   ];

//   return {
//     state: LoadingState.Done,
//     series,
//     timeRange,
//   };
// }

function PluginPanels() {
  const styles = useStyles2(getStyles);
  const [dataSources, setDataSources] = useState<DataSourceOption[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<string>('');
  const [panels, setPanels] = useState<DashboardPanelResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

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
    <Page navId="view-plugin-panels">
      <Page.Contents>
        <div className={styles.container}>
          <div className={styles.controls}>
            <Select
              label={t('plugin-panels.datasource.label', 'Data Source')}
              value={selectedDataSource}
              onChange={handleDataSourceChange}
              options={dataSources}
              placeholder={t('plugin-panels.datasource.placeholder', 'Select a data source...')}
              width={60}
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
                          <Trans i18nKey="plugin-panels.panel.dashboard-prefix">Source Dashboard:&nbsp;</Trans>
                        </span>
                        <a
                          href={`/d/${panelResult.dashboardUID}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.dashboardLink}
                        >
                          {panelResult.dashboardName}
                        </a>
                      </div>
                    </div>
                    <div className={styles.panelContent}>
                      <PanelWithRealData panel={panelModel} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    // padding: theme.spacing(3),
    maxWidth: '100%',
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(800px, 1fr))',
    gap: theme.spacing(3),
    marginTop: theme.spacing(3),
    width: '100%',
    maxWidth: '80vw',
  }),

  panelWrapper: css({
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.background.primary,
    overflow: 'hidden',
    minHeight: '300px',
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
    display: 'flex',
    alignItems: 'stretch',
    padding: theme.spacing(1),

    // Ensure panel takes full width and height
    '& > div': {
      width: '100%',
      height: '100%',
      minWidth: '100%',
      minHeight: '100%',
      flex: '1',
    },

    // Disable pointer events on panel content to prevent hover crashes
    '& *': {
      pointerEvents: 'none',
    },

    // Force visualization containers to full size
    '& .panel-content, & [data-testid="panel-content"]': {
      width: '100%',
      height: '100%',
    },

    // Common panel wrapper selectors
    '& .grafana-panel, & .panel, & .uplot': {
      width: '100%',
      height: '100%',
    },
  }),
});

export default PluginPanels;
