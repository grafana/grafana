import { nanoid } from 'nanoid';
import { ReactElement, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom-v5-compat';
import AutoSizer from 'react-virtualized-auto-sizer';

import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizConfigBuilders, sceneUtils } from '@grafana/scenes';
import {
  SceneContextProvider,
  VizGridLayout,
  VizPanel,
  useDataTransformer,
  useQueryRunner,
} from '@grafana/scenes-react';
import { InlineField, InlineFieldRow, MultiCombobox, Select, Tab, TabContent, TabsBar } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { LogFilter, LogViewFilters } from './logs/LogViewFilters';
import { ExtensionsLogDataSource } from './logs/dataSource';
import { createFilterTransformation } from './logs/filterTransformation';
import { log } from './logs/log';
import { DependencyGraph } from './sunker-plugindependencygraph-plugin/components/DependencyGraph';
import {
  getActiveContentConsumers,
  getAvailableContentConsumers,
  getAvailableContentProviders,
  getDefaultOptions,
  processPluginDataToGraph,
} from './sunker-plugindependencygraph-plugin/utils/dataProcessor';

const DATASOURCE_REF = {
  uid: nanoid(),
  type: 'grafana-extensionslog-datasource',
};

const logsViz = VizConfigBuilders.logs().setOption('wrapLogMessage', true).build();

// Scene object for managing tab state with URL sync
interface ExtensionsTabState extends SceneObjectState {
  activeTab: number;
}

class ExtensionsTabSceneObject extends SceneObjectBase<ExtensionsTabState> {
  static Component = ExtensionsTabbedPageContent;

  public constructor(state: Partial<ExtensionsTabState>) {
    super({
      activeTab: 0,
      ...state,
    });
  }

  public getActiveTabFromPath(pathname: string): number {
    if (pathname.endsWith('/log')) {
      return 0;
    } else if (pathname.endsWith('/dependency-graph')) {
      return 1;
    }
    return 0; // default to log tab
  }

  public getTabPath(tabIndex: number): string {
    return tabIndex === 0 ? '/admin/extensions/log' : '/admin/extensions/dependency-graph';
  }

  public setActiveTab(tabIndex: number): void {
    this.setState({ activeTab: tabIndex });
  }
}

sceneUtils.registerRuntimeDataSource({
  dataSource: new ExtensionsLogDataSource(DATASOURCE_REF.type, DATASOURCE_REF.uid, log),
});

// Log Viewer Tab Content Component
function LogViewerTabContent(): ReactElement {
  const [filter, setFilter] = useState<LogFilter>({});

  const data = useQueryRunner({
    datasource: DATASOURCE_REF,
    queries: [{ refId: 'A' }],
    liveStreaming: true,
  });

  const filteredData = useDataTransformer({
    transformations: [createFilterTransformation(filter)],
    data: data,
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px' }}>
        <LogViewFilters provider={data} filteredProvider={filteredData} filter={filter} onChange={setFilter} />
      </div>
      <div style={{ flex: 1, padding: '16px' }}>
        <AutoSizer>
          {({ height, width }) => (
            <VizGridLayout minHeight={height} minWidth={width}>
              <VizPanel title="" viz={logsViz} dataProvider={filteredData} />
            </VizGridLayout>
          )}
        </AutoSizer>
      </div>
    </div>
  );
}

// New Scenes Tab Content Component
function NewScenesTabContent(): ReactElement {
  const [visualizationMode, setVisualizationMode] = useState<'add' | 'expose'>('add');
  const [selectedContentProviders, setSelectedContentProviders] = useState<string[]>([]);
  const [selectedContentConsumers, setSelectedContentConsumers] = useState<string[]>([]);

  // Process the plugin data for the dependency graph
  const graphData = useMemo(() => {
    const options = {
      ...getDefaultOptions(),
      visualizationMode,
      showDependencyTypes: true,
      showDescriptions: false,
      selectedContentProviders,
      selectedContentConsumers,
      linkExtensionColor: '#37872d',
      componentExtensionColor: '#ff9900',
      functionExtensionColor: '#e02f44',
    };
    const data = processPluginDataToGraph(options);
    console.log('Graph data:', data);
    return data;
  }, [visualizationMode, selectedContentProviders, selectedContentConsumers]);

  const modeOptions = [
    { label: t('extensions.api-mode.add', 'Add'), value: 'add' as const },
    { label: t('extensions.api-mode.expose', 'Expose'), value: 'expose' as const },
  ];

  // Get available content providers based on visualization mode
  const availableProviders = getAvailableContentProviders(visualizationMode);
  const contentProviderOptions = availableProviders.map((provider) => ({
    label: provider === 'grafana-core' ? t('extensions.grafana-core', 'Grafana Core') : provider,
    value: provider,
  }));

  // If no value is set (empty array) or value is not defined, default to all providers selected
  const selectedProviderValues =
    !selectedContentProviders || selectedContentProviders.length === 0 ? availableProviders : selectedContentProviders;

  // Get available content consumers based on visualization mode
  const availableConsumers = getAvailableContentConsumers(visualizationMode);
  const activeConsumers = getActiveContentConsumers(visualizationMode);
  const contentConsumerOptions = availableConsumers.map((consumer) => ({
    label: consumer === 'grafana-core' ? t('extensions.grafana-core', 'Grafana Core') : consumer,
    value: consumer,
  }));

  // If no consumers are selected (empty array), show active consumers (those with providers)
  const selectedConsumerValues =
    !selectedContentConsumers || selectedContentConsumers.length === 0 ? activeConsumers : selectedContentConsumers;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px' }}>
        {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
        <h2>Plugin Dependency Graph</h2>
        {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
        <p>Visualize plugin dependencies and extension points using Grafana Scenes</p>
        {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
        <p>
          Nodes: {graphData.nodes.length}, Dependencies: {graphData.dependencies.length}, Extension Points:{' '}
          {graphData.extensionPoints.length}
        </p>

        {/* API Mode Selector */}
        <div style={{ marginTop: '16px', marginBottom: '16px' }}>
          <InlineFieldRow>
            <InlineField label={t('extensions.api-mode.label', 'API Mode')}>
              <Select
                options={modeOptions}
                value={visualizationMode}
                onChange={(option) => {
                  if (option.value === 'add' || option.value === 'expose') {
                    setVisualizationMode(option.value);
                  }
                }}
                width={12}
              />
            </InlineField>
            <InlineField label={t('extensions.content-provider.label', 'Content provider')}>
              <MultiCombobox
                options={contentProviderOptions}
                value={selectedProviderValues}
                onChange={(selected) => {
                  // Extract values from SelectableValue objects
                  const selectedValues = selected.map((item) => item.value).filter((v): v is string => Boolean(v));
                  // If all providers are selected, store empty array to indicate "show all"
                  const newValue = selectedValues.length === availableProviders.length ? [] : selectedValues;
                  setSelectedContentProviders(newValue);
                }}
                placeholder={t('extensions.content-provider.placeholder', 'Select content providers to display')}
                width="auto"
                minWidth={100}
                maxWidth={100}
              />
            </InlineField>
            <InlineField label={t('extensions.content-consumer.label', 'Content consumer')}>
              <MultiCombobox
                options={contentConsumerOptions}
                value={selectedConsumerValues}
                onChange={(selected) => {
                  // Extract values from SelectableValue objects
                  const selectedValues = selected.map((item) => item.value).filter((v): v is string => Boolean(v));
                  // If active consumers are selected (default state), store empty array to indicate default behavior
                  const isDefaultSelection =
                    selectedValues.length === activeConsumers.length &&
                    activeConsumers.every((consumer) => selectedValues.includes(consumer));
                  const newValue = isDefaultSelection ? [] : selectedValues;
                  setSelectedContentConsumers(newValue);
                }}
                placeholder={t(
                  'extensions.content-consumer.placeholder',
                  'Select content consumers to display (active consumers by default)'
                )}
                width="auto"
                minWidth={100}
                maxWidth={100}
              />
            </InlineField>
          </InlineFieldRow>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'visible', minHeight: '500px', width: '100%' }}>
        <AutoSizer disableHeight>
          {({ width }) => {
            console.log('AutoSizer width:', width);
            const effectiveWidth = width || 1200; // Fallback width if AutoSizer fails
            return (
              <div style={{ width: effectiveWidth, minHeight: '500px' }}>
                <DependencyGraph
                  data={graphData}
                  options={{
                    ...getDefaultOptions(),
                    visualizationMode,
                    showDependencyTypes: true,
                    showDescriptions: false,
                    selectedContentProviders,
                    selectedContentConsumers,
                    linkExtensionColor: '#37872d',
                    componentExtensionColor: '#ff9900',
                    functionExtensionColor: '#e02f44',
                  }}
                  width={effectiveWidth}
                  height={2000} // Use a large height to allow content to expand
                />
              </div>
            );
          }}
        </AutoSizer>
      </div>
    </div>
  );
}

// Main component that renders the tabbed layout with nested routing
function ExtensionsTabbedPageContent({ model }: SceneComponentProps<ExtensionsTabSceneObject>): ReactElement {
  const location = useLocation();
  const { activeTab } = model.useState();

  // Update active tab based on current path
  const currentTab = model.getActiveTabFromPath(location.pathname);
  if (currentTab !== activeTab) {
    model.setState({ activeTab: currentTab });
  }

  return (
    <Page navId="extensions">
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <TabsBar>
          <Tab
            label={t('extensions.tabs.log-viewer', 'Log Viewer')}
            active={activeTab === 0}
            onChangeTab={() => {
              model.setActiveTab(0);
              // Navigate to the log tab
              locationService.push(model.getTabPath(0));
            }}
          />
          <Tab
            label={t('extensions.tabs.dependency-graph', 'Dependency Graph')}
            active={activeTab === 1}
            onChangeTab={() => {
              model.setActiveTab(1);
              // Navigate to the dependency-graph tab
              locationService.push(model.getTabPath(1));
            }}
          />
        </TabsBar>
        <TabContent style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Navigate to="log" replace />} />
            <Route path="log" element={<LogViewerTabContent />} />
            <Route path="dependency-graph" element={<NewScenesTabContent />} />
          </Routes>
        </TabContent>
      </div>
    </Page>
  );
}

// Main component that renders the tabbed layout
export default function ExtensionsTabbedPage(): ReactElement {
  const [tabScene] = useState(() => new ExtensionsTabSceneObject({ activeTab: 0 }));

  return (
    <SceneContextProvider>
      <tabScene.Component model={tabScene} />
    </SceneContextProvider>
  );
}
