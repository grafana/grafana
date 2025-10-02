// Import the scenes plugin registration
import './sunker-plugindependencygraph-plugin/scenesPlugin';

import { nanoid } from 'nanoid';
import { ReactElement, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { VizConfigBuilders, sceneUtils } from '@grafana/scenes';
import {
  SceneContextProvider,
  VizGridLayout,
  VizPanel,
  useDataTransformer,
  useQueryRunner,
} from '@grafana/scenes-react';
import { Tab, TabContent, TabsBar } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { LogFilter, LogViewFilters } from './logs/LogViewFilters';
import { ExtensionsLogDataSource } from './logs/dataSource';
import { createFilterTransformation } from './logs/filterTransformation';
import { log } from './logs/log';

const DATASOURCE_REF = {
  uid: nanoid(),
  type: 'grafana-extensionslog-datasource',
};

const logsViz = VizConfigBuilders.logs().setOption('wrapLogMessage', true).build();

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
      <div style={{ padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
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
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
        {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
        <h2>Plugin Dependency Graph</h2>
        {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
        <p>Visualize plugin dependencies and extension points using Grafana Scenes</p>
      </div>
      <div style={{ flex: 1, padding: '16px' }}>
        <AutoSizer>
          {({ height, width }) => (
            <VizGridLayout minHeight={height} minWidth={width}>
              <VizPanel
                // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                title="Plugin Dependencies"
                viz={{
                  pluginId: 'grafana-extensions-plugin-dependency-graph',
                  pluginVersion: '1.0.0',
                  options: {
                    visualizationMode: 'add',
                    showDependencyTypes: true,
                    showDescriptions: false,
                    selectedContentProviders: [],
                    selectedContentConsumers: [],
                    linkExtensionColor: '#37872d',
                    componentExtensionColor: '#ff9900',
                    functionExtensionColor: '#e02f44',
                  },
                  fieldConfig: {
                    defaults: {},
                    overrides: [],
                  },
                }}
              />
            </VizGridLayout>
          )}
        </AutoSizer>
      </div>
    </div>
  );
}

// Main component that renders the tabbed layout
export default function ExtensionsTabbedPage(): ReactElement {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <SceneContextProvider>
      <Page navId="extensions">
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <TabsBar>
            {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
            <Tab label="Log Viewer" active={activeTab === 0} onChangeTab={() => setActiveTab(0)} />
            {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
            <Tab label="New Scenes" active={activeTab === 1} onChangeTab={() => setActiveTab(1)} />
          </TabsBar>
          <TabContent style={{ flex: 1 }}>
            {activeTab === 0 && <LogViewerTabContent />}
            {activeTab === 1 && <NewScenesTabContent />}
          </TabContent>
        </div>
      </Page>
    </SceneContextProvider>
  );
}
