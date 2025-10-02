import { css } from '@emotion/css';
import { once } from 'lodash';
import { useEffect, useMemo, useState } from 'react';

import { DataSourceInstanceSettings, DataSourceRef, GrafanaTheme2, AdHocVariableFilter } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction, useFavoriteDatasources } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import {
  Modal,
  useStyles2,
  Input,
  Icon,
  ScrollContainer,
  Text,
  TabsBar,
  Tab,
  Button,
  IconButton,
  FileDropzone,
  FileDropzoneDefaultChildren,
} from '@grafana/ui';
import { GrafanaQuery } from 'app/plugins/datasource/grafana/types';
import { getSparkJoyEnabled } from 'app/core/utils/sparkJoy';

import { acceptedFiles, maxFileSize } from 'app/features/dataframe-import/constants';
import { getFileDropToQueryHandler } from 'app/plugins/datasource/grafana/utils';

import { getDatasourceSrv } from '../../../plugins/datasource_srv';
import { AdHocFilter } from '../../../variables/adhoc/picker/AdHocFilter';
import { useDatasource, useDatasources } from '../../hooks';

import { AddNewDataSourceButton } from './AddNewDataSourceButton';
import { BuiltInDataSourceList } from './BuiltInDataSourceList';
import { DataSourceList } from './DataSourceList';
import { matchDataSourceWithSearch } from './utils';
import { createAssistantContextItem, openAssistant } from '@grafana/assistant';

const INTERACTION_EVENT_NAME = 'dashboards_dspickermodal_clicked';
const INTERACTION_ITEM = {
  SELECT_DS: 'select_ds',
  UPLOAD_FILE: 'upload_file',
  CONFIG_NEW_DS: 'config_new_ds',
  CONFIG_NEW_DS_EMPTY_STATE: 'config_new_ds_empty_state',
  SEARCH: 'search',
  DISMISS: 'dismiss',
  OPEN_MODAL: 'open_modal',
};

export interface DataSourceModalProps {
  onChange: (ds: DataSourceInstanceSettings, defaultQueries?: DataQuery[] | GrafanaQuery[]) => void;
  current: DataSourceRef | string | null | undefined;
  onDismiss: () => void;
  recentlyUsed?: string[];
  reportedInteractionFrom?: string;

  // DS filters
  filter?: (ds: DataSourceInstanceSettings) => boolean;
  tracing?: boolean;
  mixed?: boolean;
  dashboard?: boolean;
  metrics?: boolean;
  type?: string | string[];
  annotations?: boolean;
  variables?: boolean;
  alerting?: boolean;
  pluginId?: string;
  logs?: boolean;
  uploadFile?: boolean;
}

export function DataSourceModal({
  tracing,
  dashboard,
  mixed,
  metrics,
  type,
  annotations,
  variables,
  alerting,
  pluginId,
  logs,
  uploadFile,
  filter,
  onChange,
  current,
  onDismiss,
  reportedInteractionFrom,
}: DataSourceModalProps) {
  const sparkJoyEnabled = getSparkJoyEnabled(true);
  
  // If sparkJoy is disabled, render the original/simple modal
  if (!sparkJoyEnabled) {
    return <OriginalDataSourceModal 
      tracing={tracing}
      dashboard={dashboard}
      mixed={mixed}
      metrics={metrics}
      type={type}
      annotations={annotations}
      variables={variables}
      alerting={alerting}
      pluginId={pluginId}
      logs={logs}
      uploadFile={uploadFile}
      filter={filter}
      onChange={onChange}
      current={current}
      onDismiss={onDismiss}
      reportedInteractionFrom={reportedInteractionFrom}
    />;
  }
  
  // SparkJoy enabled - render the enhanced modal
  const styles = useStyles2(getDataSourceModalStyles);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('infrastructure');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<DataSourceInstanceSettings | null>(null);
  const [adHocFilters, setAdHocFilters] = useState<AdHocVariableFilter[]>([]);
  const analyticsInteractionSrc = reportedInteractionFrom || 'modal';

  // Preferred labels to pre-select (in order of preference)
  const preferredLabels = ['compose_service','service_name', 'job', 'app', 'cluster', 'detected_level'];
  const favoriteDataSources = useFavoriteDatasources();

  const getInfrastructureMetrics = (dataSourceType?: string) => {
    if (dataSourceType === 'loki') {
      return [
        'Error log count',
        'Warning log count',
        'Log volume by service',
        'Log parsing errors',
        'Failed requests in logs',
        'Application errors',
        'Authentication failures',
        'Rate limit violations',
        'Database connection errors',
      ];
    } else if (dataSourceType === 'prometheus') {
      return [
        'CPU utilization (%)',
        'Memory usage (GiB)',
        'Request latency (ms)',
        'Error rate (HTTP 5xx %)',
        'Throughput (req/sec)',
        'Disk I/O (MB/s)',
        'Network I/O (MB/s)',
        'Query duration (ms)',
        'Uptime / availability (%)',
      ];
    } else {
      // Default metrics for other data sources
      return [
        'CPU utilization (%)',
        'Request latency (ms)',
        'Query duration (ms)',
        'Error rate (HTTP 5xx %)',
        'Memory usage (GiB)',
        'Disk I/O throughput (MB/s)',
        'Log error occurrences',
        'Uptime / availability (%)',
        'Throughput / requests per second',
      ];
    }
  };

  const infrastructureMetrics = getInfrastructureMetrics(selectedDataSource?.type);

  const onDismissModal = () => {
    onDismiss();
    reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.DISMISS, src: analyticsInteractionSrc });
  };
  const onChangeDataSource = async (ds: DataSourceInstanceSettings) => {
    setSelectedDataSource(ds);
    console.log('Selected data source:', ds);
    
    // Fetch available labels and pre-select the first matching preferred label
    try {
      const datasourceInstance = await getDatasourceSrv().get(ds);
      
      if (datasourceInstance && datasourceInstance.getTagKeys) {
        const response = await datasourceInstance.getTagKeys({ filters: [] });
        const availableLabels = Array.isArray(response) ? response : response.data;
        const labelNames = availableLabels.map(label => label.text);
        
        console.log('Available labels:', labelNames);
        
        // Find the first preferred label that exists in the data source
        const matchingLabel = preferredLabels.find(preferred => 
          labelNames.includes(preferred)
        );
        
        // Always start with empty filters - let user build them through the UI
        setAdHocFilters([]);
        if (matchingLabel) {
          console.log('Available preferred label found:', matchingLabel, 'but starting with empty filters for now');
        } else {
          console.log('No preferred labels found, starting with empty filters');
        }
      } else {
        // Data source doesn't support ad hoc filters
        setAdHocFilters([]);
        console.log('Data source does not support ad hoc filters');
      }
    } catch (error) {
      console.error('Error fetching labels:', error);
      setAdHocFilters([]);
    }
    
    reportInteraction(INTERACTION_EVENT_NAME, {
      item: INTERACTION_ITEM.SELECT_DS,
      ds_type: ds.type,
      src: analyticsInteractionSrc,
      is_favorite: favoriteDataSources.enabled ? favoriteDataSources.isFavoriteDatasource(ds.uid) : undefined,
    });
  };

  const handleMetricClick = (metric: string) => {
    setSelectedMetrics(prev => {
      const newSelection = prev.includes(metric) 
        ? prev.filter(m => m !== metric)  // Remove if already selected
        : [...prev, metric];              // Add if not selected
      
      console.log('Selected metrics:', newSelection);
      return newSelection;
    });
  };

  const handleContinue = () => {
    if (!selectedDataSource) {
      return;
    }

    // Create context items for each selected metric
    const metricContextItems = selectedMetrics.map(metric => 
      createAssistantContextItem('structured', {
        title: metric,
        data: {
          type: 'metric',
          name: metric,
        },
      })
    );

    // Create context items for each AdHoc filter
    const labelContextItems = adHocFilters.flatMap(filter => {
      const contextItems = [];
      
      // Add label_name context
      if (filter.key) {
        contextItems.push(
          createAssistantContextItem('label_name', {
            datasourceUid: selectedDataSource.uid,
            labelName: filter.key,
          })
        );
      }
      
      // Add label_value context if value exists
      if (filter.key && filter.value) {
        contextItems.push(
          createAssistantContextItem('label_value', {
            datasourceUid: selectedDataSource.uid,
            labelName: filter.key,
            labelValue: filter.value,
          })
        );
      }
      
      return contextItems;
    });

    openAssistant({
      prompt: `Create a panel using ${selectedDataSource.name}. I would like to visualize following metrics: ${selectedMetrics.join(', ')} for ${adHocFilters.map(filter => `${filter.key}${filter.operator}${filter.value}`).join(', ')}. Select the appropriate visualization to present data in the best way.`,
      autoSend: true,
      origin: 'datasource-picker',
      context: [
        createAssistantContextItem('structured', {
          hidden: true,
          title: 'Instructions',
          data: {
            instructions: 'Identify a query that will help me visualize the data based on provided context. Then edit panel 1 in which you currently are and selected the appropriate visualisation to present data in the best way',
          },
        }),
        createAssistantContextItem('datasource', {
          datasourceUid: selectedDataSource.uid,
        }),
        ...metricContextItems,
        ...labelContextItems,
      ],
    });
    onDismiss();
  };

  const handleAddFilter = (filter: AdHocVariableFilter) => {
    console.log('Adding filter:', filter);
    if (!filter.key || !filter.operator) {
      console.error('Invalid filter - missing key or operator:', filter);
      return;
    }
    setAdHocFilters(prev => {
      const newFilters = [...prev, filter];
      console.log('New filters array:', newFilters);
      return newFilters;
    });
  };

  const handleRemoveFilter = (index: number) => {
    console.log('Removing filter at index:', index);
    setAdHocFilters(prev => {
      const newFilters = prev.filter((_, i) => i !== index);
      console.log('Filters after removal:', newFilters);
      return newFilters;
    });
  };

  const handleChangeFilter = (index: number, filter: AdHocVariableFilter) => {
    console.log('Changing filter at index:', index, 'to:', filter);
    if (!filter.key || !filter.operator) {
      console.error('Invalid filter change - missing key or operator:', filter);
      return;
    }
    setAdHocFilters(prev => {
      const newFilters = prev.map((f, i) => i === index ? filter : f);
      console.log('Filters after change:', newFilters);
      return newFilters;
    });
  };

  // Get all datasources to report total_configured count
  const dataSources = useDatasources({
    tracing,
    dashboard,
    mixed,
    metrics,
    type,
    annotations,
    variables,
    alerting,
    pluginId,
    logs,
  });

  // Report interaction when modal is opened
  useEffect(() => {
    if (dataSources.length > 0) {
      reportInteraction(INTERACTION_EVENT_NAME, {
        item: INTERACTION_ITEM.OPEN_MODAL,
        src: analyticsInteractionSrc,
        creator_team: 'grafana_plugins_catalog',
        schema_version: '1.0.0',
        total_configured: dataSources.length,
      });
    }
  }, [analyticsInteractionSrc, dataSources.length]);

  // Memoizing to keep once() cached so it avoids reporting multiple times
  const reportSearchUsageOnce = useMemo(
    () =>
      once(() => {
        reportInteraction(INTERACTION_EVENT_NAME, { item: 'search', src: analyticsInteractionSrc });
      }),
    [analyticsInteractionSrc]
  );

  return (
    <Modal
      title=""
      closeOnEscape={true}
      closeOnBackdropClick={true}
      isOpen={true}
      className={styles.modal}
      contentClassName={styles.modalContent}
      onClickBackdrop={onDismissModal}
      onDismiss={onDismissModal}
    >
      <div className={styles.closeButtonContainer}>
        <IconButton
          name="times"
          size="xl"
          onClick={onDismissModal}
          // className={styles.closeButton}
          aria-label={t('data-source-picker.modal.close', 'Close modal')}
          tooltip={t('data-source-picker.modal.close', 'Close modal')}
        />
      </div>
      <div className={styles.singleColumn}>
        <div className={styles.stepHeading}>
        <Text element="h4" >
          {t('data-source-picker.modal.step1', '1. Select data source')}
        </Text>
        </div>
        <Input
          type="search"
          autoFocus
          className={styles.searchInput}
          value={search}
          prefix={<Icon name="search" />}
          placeholder={t('data-source-picker.modal.input-placeholder', 'Select data source')}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            reportSearchUsageOnce();
          }}
        />
        <div className={styles.dataSourceListContainer}>
          <ScrollContainer>
          <DataSourceList
            onChange={onChangeDataSource}
            current={selectedDataSource || current}
            onClickEmptyStateCTA={() =>
              reportInteraction(INTERACTION_EVENT_NAME, {
                item: INTERACTION_ITEM.CONFIG_NEW_DS_EMPTY_STATE,
                src: analyticsInteractionSrc,
              })
            }
              filter={(ds) => (filter ? filter?.(ds) : true) && matchDataSourceWithSearch(ds, search) && !ds.meta.builtIn}
              variables={variables}
              tracing={tracing}
              metrics={metrics}
              type={type}
              annotations={annotations}
              alerting={alerting}
              pluginId={pluginId}
              logs={logs}
              dashboard={dashboard}
              mixed={mixed}
              dataSources={dataSources}
            />
          </ScrollContainer>
        </div>
        
        <div className={styles.separator}></div>
        
        <div className={styles.stepHeading}>
         <Text element="h4">
           {t('data-source-picker.modal.step2', '2. Pick what would you like to visualize')}
         </Text>
       </div>
       
       <div className={styles.tabsSection}>
         <TabsBar>
           <Tab
             label={t('data-source-picker.modal.infrastructure-metrics', 'Infrastructure metrics')}
             active={activeTab === 'infrastructure'}
             onChangeTab={() => setActiveTab('infrastructure')}
           />
           <Tab
             label={t('data-source-picker.modal.business-metrics', 'Business metrics')}
             active={activeTab === 'business'}
             onChangeTab={() => setActiveTab('business')}
           />
         </TabsBar>
         
         <div className={styles.metricsContainer}>
           {activeTab === 'infrastructure' && (
             <div className={styles.pillsContainer}>
               {infrastructureMetrics.map((metric, index) => {
                 const isSelected = selectedMetrics.includes(metric);
                 return (
                   <button
                     key={index}
                     type="button"
                     className={`${styles.metricPill} ${isSelected ? styles.metricPillSelected : ''}`}
                     onClick={() => handleMetricClick(metric)}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter' || e.key === ' ') {
                         e.preventDefault();
                         handleMetricClick(metric);
                       }
                     }}
                   >
                     {metric}
                   </button>
                 );
               })}
               <div className={styles.addButtonSmall}>
                 <Icon name="plus" />
               </div>
             </div>
           )}
           {activeTab === 'business' && (
             <div className={styles.emptyState}>
               {/* Empty for now */}
             </div>
           )}
         </div>
       </div>
       
       <div className={styles.separator}></div>
       
       <div className={styles.stepHeading}>
         <Text element="h4">
           {t('data-source-picker.modal.step3', '3. Pick scope or filter')}
         </Text>
       </div>
       
       <div className={styles.filtersSection}>
         {selectedDataSource ? (
           <AdHocFilter
             datasource={{ type: selectedDataSource.type, uid: selectedDataSource.uid }}
             filters={adHocFilters}
             addFilter={handleAddFilter}
             removeFilter={handleRemoveFilter}
             changeFilter={handleChangeFilter}
           />
         ) : (
           <div className={styles.pillsContainer}>
             <div className={styles.addButton}>
               <Icon name="plus" />
             </div>
           </div>
         )}
      </div>
      
      <div className={styles.continueSection}>
        <div className={styles.buttonRow}>
          <Button 
            onClick={handleContinue}
            size="md"
            variant="secondary"
            icon="ai-sparkle"
            className={styles.visualiseButton}
            disabled={!selectedDataSource}
            tooltip={!selectedDataSource ? t('data-source-picker.modal.visualise-tooltip', 'Select data source first') : undefined}
          >
            {t('data-source-picker.modal.visualise', 'Visualize with Assistant')}
          </Button>
          <Button 
          // close modal
            onClick={() => onDismiss()}
            size="md"
            variant="secondary"
            className={styles.skipButton}
          >
            {t('data-source-picker.modal.skip', 'Cancel')}
          </Button>
        </div>
        <div className={styles.descriptionText}>
          {t('data-source-picker.modal.description', 
            'Your visualization will be created by ✨Assistant based on common usage and recommended visualisation and other properties for your selected metric and scope.\nYou can edit more details in the next step.\nThis process may take a moment.'
          )}
        </div>
      </div>
     </div>
    </Modal>
  );
}

// Original DataSourceModal (when sparkJoy is disabled)
function OriginalDataSourceModal({
  tracing,
  dashboard,
  mixed,
  metrics,
  type,
  annotations,
  variables,
  alerting,
  pluginId,
  logs,
  uploadFile,
  filter,
  onChange,
  current,
  onDismiss,
  reportedInteractionFrom,
}: DataSourceModalProps) {
  const styles = useStyles2(getOriginalDataSourceModalStyles);
  const [search, setSearch] = useState('');
  const analyticsInteractionSrc = reportedInteractionFrom || 'modal';
  const favoriteDataSources = useFavoriteDatasources();

  const onDismissModal = () => {
    onDismiss();
    reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.DISMISS, src: analyticsInteractionSrc });
  };
  
  const onChangeDataSource = (ds: DataSourceInstanceSettings) => {
    onChange(ds);
    reportInteraction(INTERACTION_EVENT_NAME, {
      item: INTERACTION_ITEM.SELECT_DS,
      ds_type: ds.type,
      src: analyticsInteractionSrc,
      is_favorite: favoriteDataSources.enabled ? favoriteDataSources.isFavoriteDatasource(ds.uid) : undefined,
    });
  };

  const grafanaDS = useDatasource('-- Grafana --');

  // Get all datasources to report total_configured count
  const dataSources = useDatasources({
    tracing,
    dashboard,
    mixed,
    metrics,
    type,
    annotations,
    variables,
    alerting,
    pluginId,
    logs,
  });

  // Report interaction when modal is opened
  useEffect(() => {
    if (dataSources.length > 0) {
      reportInteraction(INTERACTION_EVENT_NAME, {
        item: INTERACTION_ITEM.OPEN_MODAL,
        src: analyticsInteractionSrc,
        creator_team: 'grafana_plugins_catalog',
        schema_version: '1.0.0',
        total_configured: dataSources.length,
      });
    }
  }, [analyticsInteractionSrc, dataSources.length]);

  // Memoizing to keep once() cached so it avoids reporting multiple times
  const reportSearchUsageOnce = useMemo(
    () =>
      once(() => {
        reportInteraction(INTERACTION_EVENT_NAME, { item: 'search', src: analyticsInteractionSrc });
      }),
    [analyticsInteractionSrc]
  );

  const onFileDrop = getFileDropToQueryHandler((query, fileRejections) => {
    if (!grafanaDS) {
      return;
    }
    onChange(grafanaDS, [query]);

    reportInteraction(INTERACTION_EVENT_NAME, {
      item: INTERACTION_ITEM.UPLOAD_FILE,
      src: analyticsInteractionSrc,
    });

    if (fileRejections.length < 1) {
      onDismiss();
    }
  });

  // Built-in data sources used twice because of mobile layout adjustments
  // In mobile the list is appended to the bottom of the DS list
  const BuiltInList = ({ className }: { className?: string }) => {
    return (
      <BuiltInDataSourceList
        className={className}
        onChange={onChangeDataSource}
        current={current}
        filter={filter}
        variables={variables}
        tracing={tracing}
        metrics={metrics}
        type={type}
        annotations={annotations}
        alerting={alerting}
        pluginId={pluginId}
        logs={logs}
        dashboard={dashboard}
        mixed={mixed}
      />
    );
  };

  return (
    <Modal
      title={t('data-source-picker.modal.title', 'Select data source')}
      closeOnEscape={true}
      closeOnBackdropClick={true}
      isOpen={true}
      className={styles.modal}
      contentClassName={styles.modalContent}
      onClickBackdrop={onDismissModal}
      onDismiss={onDismissModal}
    >
      <div className={styles.leftColumn}>
        <Input
          type="search"
          autoFocus
          className={styles.searchInput}
          value={search}
          prefix={<Icon name="search" />}
          placeholder={t('data-source-picker.modal.input-placeholder', 'Select data source')}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            reportSearchUsageOnce();
          }}
        />
        <ScrollContainer>
          <DataSourceList
            onChange={onChangeDataSource}
            current={current}
            onClickEmptyStateCTA={() =>
              reportInteraction(INTERACTION_EVENT_NAME, {
                item: INTERACTION_ITEM.CONFIG_NEW_DS_EMPTY_STATE,
                src: analyticsInteractionSrc,
              })
            }
            filter={(ds) => (filter ? filter?.(ds) : true) && matchDataSourceWithSearch(ds, search) && !ds.meta.builtIn}
            variables={variables}
            tracing={tracing}
            metrics={metrics}
            type={type}
            annotations={annotations}
            alerting={alerting}
            pluginId={pluginId}
            logs={logs}
            dashboard={dashboard}
            mixed={mixed}
            dataSources={dataSources}
          />
          <BuiltInList className={styles.appendBuiltInDataSourcesList} />
        </ScrollContainer>
      </div>
      <div className={styles.rightColumn}>
        <div className={styles.builtInDataSources}>
          <div className={styles.builtInDataSourcesList}>
            <ScrollContainer>
              <BuiltInList />
            </ScrollContainer>
          </div>
          {uploadFile && config.featureToggles.editPanelCSVDragAndDrop && (
            <FileDropzone
              readAs="readAsArrayBuffer"
              fileListRenderer={() => undefined}
              options={{
                maxSize: maxFileSize,
                multiple: false,
                accept: acceptedFiles,
                onDrop: onFileDrop,
              }}
            >
              <FileDropzoneDefaultChildren />
            </FileDropzone>
          )}
        </div>
        <div className={styles.newDSSection}>
          <span className={styles.newDSDescription}>
            <Trans i18nKey="data-source-picker.modal.configure-new-data-source">
              Open a new tab and configure a data source
            </Trans>
          </span>
          <AddNewDataSourceButton
            variant="secondary"
            onClick={() => {
              reportInteraction(INTERACTION_EVENT_NAME, {
                item: INTERACTION_ITEM.CONFIG_NEW_DS,
                src: analyticsInteractionSrc,
              });
              onDismiss();
            }}
          />
        </div>
      </div>
    </Modal>
  );
}

function getDataSourceModalStyles(theme: GrafanaTheme2) {
  return {
    modal: css({
      width: '100vw',
      height: '100vh',
      maxWidth: 'none',
      maxHeight: 'none',
      margin: 0,
      borderRadius: 0,
    }),
    modalContent: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'auto',
      padding: `${theme.spacing(6)} ${theme.spacing(8)}`,
      maxWidth: '1400px',
      margin: '0 auto',
      position: 'relative',
    }),
    closeButtonContainer: css({
      position: 'absolute',
      top: theme.spacing(2),
      right: theme.spacing(2),
      zIndex: 1000,
    }),
    closeButton: css({
      backgroundColor: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.medium}`,
      '&:hover': {
        backgroundColor: theme.colors.background.canvas,
      },
    }),
    singleColumn: css({
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
    }),
    dataSourceListContainer: css({
      height: 'calc(80vh * 0.3)',
      maxHeight: 'calc(80vh * 0.3)',
      overflow: 'hidden',
      flex: '0 0 auto',
    }),
    searchInput: css({
      width: '100%',
      minHeight: '32px',
      marginBottom: theme.spacing(1),
    }),
    stepHeading: css({
      marginBottom: theme.spacing(2),
      marginTop: theme.spacing(2),
      fontSize: theme.typography.h4.fontSize,
      fontWeight: theme.typography.h4.fontWeight,
      color: theme.colors.text.primary,
    }),
    separator: css({
      height: '1px',
      backgroundColor: theme.colors.border.weak,
      marginTop: theme.spacing(2.5),
      width: '100%',
    }),
    tabsSection: css({
      marginTop: theme.spacing(0.5),
    }),
    metricsContainer: css({
      marginTop: theme.spacing(1.5),
    }),
    pillsContainer: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(1),
      alignItems: 'center',
    }),
    metricPill: css({
      backgroundColor: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.primary,
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: theme.colors.background.canvas,
      },
    }),
    metricPillSelected: css({
      backgroundColor: theme.colors.primary.main,
      borderColor: theme.colors.primary.main,
      color: theme.colors.primary.contrastText,
      '&:hover': {
        backgroundColor: theme.colors.primary.shade,
      },
    }),
    addButtonSmall: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '28px',
      height: '28px',
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.medium}`,
      backgroundColor: theme.colors.background.secondary,
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: theme.colors.background.canvas,
      },
    }),
    addButton: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '33px',
      height: '33px',
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.medium}`,
      backgroundColor: theme.colors.background.secondary,
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: theme.colors.background.canvas,
      },
    }),
    emptyState: css({
      minHeight: '100px',
    }),
    continueSection: css({
      marginTop: theme.spacing(3),
      paddingTop: theme.spacing(2),
      borderTop: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
    }),
    buttonRow: css({
      display: 'flex',
      gap: theme.spacing(2),
      alignItems: 'center',
    }),
    visualiseButton: css({
      minWidth: '100px',
      backgroundColor: theme.colors.secondary.main,
      color: theme.colors.secondary.contrastText,
      border: '1px solid transparent',
      borderImage: 'linear-gradient(90deg, rgb(168, 85, 247), rgb(249, 115, 22)) 1',
      '&:hover': {
        backgroundColor: theme.colors.secondary.shade,
      },
    }),
    skipButton: css({
      minWidth: '80px',
      backgroundColor: 'transparent',
      color: theme.colors.text.secondary,
      border: `1px solid ${theme.colors.border.medium}`,
      '&:hover': {
        backgroundColor: theme.colors.background.secondary,
        color: theme.colors.text.primary,
      },
    }),
    descriptionText: css({
      marginTop: theme.spacing(2),
      fontSize: theme.typography.bodySmall.fontSize,
      fontStyle: 'italic',
      color: theme.colors.text.secondary,
      lineHeight: theme.typography.bodySmall.lineHeight,
      whiteSpace: 'pre-line',
    }),
    filtersSection: css({
      marginTop: theme.spacing(1),
    }),
  };
}

function getOriginalDataSourceModalStyles(theme: GrafanaTheme2) {
  return {
    modal: css({
      width: '80%',
      maxWidth: '1200px',
      minHeight: '80%',

      [theme.breakpoints.down('md')]: {
        width: '100%',
      },
    }),
    modalContent: css({
      display: 'flex',
      flexDirection: 'row',
      flex: 1,

      [theme.breakpoints.down('md')]: {
        flexDirection: 'column',
      },
    }),
    leftColumn: css({
      display: 'flex',
      flexDirection: 'column',
      width: '50%',
      maxHeight: '100%',
      paddingRight: theme.spacing(4),
      borderRight: `1px solid ${theme.colors.border.weak}`,

      [theme.breakpoints.down('md')]: {
        width: '100%',
        borderRight: 0,
        paddingRight: 0,
        flex: 1,
        overflowY: 'auto',
      },
    }),
    rightColumn: css({
      display: 'flex',
      flexDirection: 'column',
      width: '50%',
      minHeight: '100%',
      justifyItems: 'space-evenly',
      alignItems: 'stretch',
      paddingLeft: theme.spacing(4),

      [theme.breakpoints.down('md')]: {
        width: '100%',
        paddingLeft: 0,
        flexShrink: 0,
      },
    }),
    builtInDataSources: css({
      flex: '1 1',
      marginBottom: theme.spacing(4),

      [theme.breakpoints.down('md')]: {
        flex: 0,
      },
    }),
    builtInDataSourcesList: css({
      [theme.breakpoints.down('md')]: {
        display: 'none',
        marginBottom: 0,
      },

      marginBottom: theme.spacing(4),
    }),
    appendBuiltInDataSourcesList: css({
      [theme.breakpoints.up('md')]: {
        display: 'none',
      },
    }),
    newDSSection: css({
      display: 'flex',
      flexDirection: 'row',
      width: '100%',
      justifyContent: 'space-between',
      alignItems: 'center',
    }),
    newDSDescription: css({
      flex: '1 0',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      color: theme.colors.text.secondary,
    }),
    searchInput: css({
      width: '100%',
      minHeight: '32px',
      marginBottom: theme.spacing(1),
    }),
  };
}
