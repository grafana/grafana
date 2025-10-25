import { nanoid } from 'nanoid';
import { ReactElement, useState } from 'react';
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
import { Tab, TabContent, TabsBar } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { DependencyGraphTab } from './dependency-graph/DependencyGraphTab';
import { LogFilter, LogViewFilters } from './logs/LogViewFilters';
import { ExtensionsLogDataSource } from './logs/dataSource';
import { createFilterTransformation } from './logs/filterTransformation';
import { log } from './logs/log';

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

// Dependency Graph Tab Content Component (Refactored)
function NewScenesTabContent(): ReactElement {
  return <DependencyGraphTab />;
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
