import {
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneGridLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { Button, Tab, TabsBar } from '@grafana/ui';

import { AutomaticGridLayoutManager } from './AutomaticGridLayoutManager';
import { LayoutEditChrome } from './LayoutEditChrome';
import { ManualGridLayoutManager } from './ManualGridLayoutWrapper';
import { DashboardLayoutManager, LayoutDescriptor, LayoutEditorProps } from './types';

interface TabsLayoutManagerState extends SceneObjectState {
  tabLayouts: DashboardLayoutManager[];
  tabTitles: string[];
  currentTab?: string;
}

export class TabsLayoutManager extends SceneObjectBase<TabsLayoutManagerState> implements DashboardLayoutManager {
  getNextPanelId(): number {
    throw new Error('Method not implemented.');
  }
  public editModeChanged(isEditing: boolean): void {}

  public cleanUpStateFromExplore(): void {}

  public addNewTab(): void {
    this.setState({
      tabLayouts: [
        ...this.state.tabLayouts,
        new ManualGridLayoutManager({ layout: new SceneGridLayout({ children: [] }) }),
      ],
      tabTitles: [...this.state.tabTitles, 'New tab'],
    });
  }

  public getLayoutId(): string {
    return 'automatic-grid-layout';
  }

  public changeTab(tab: string) {
    this.setState({ currentTab: tab });
  }

  public getDescriptor(): LayoutDescriptor {
    return TabsLayoutManager.getDescriptor();
  }

  public renderEditor() {
    return <TabsLayoutEditor layoutManager={this} />;
  }

  public static getDescriptor(): LayoutDescriptor {
    return {
      name: 'Tabs',
      id: 'tabs-layout',
      switchTo: TabsLayoutManager.switchTo,
    };
  }

  public getObjects(): SceneObject[] {
    const objects: SceneObject[] = [];

    // for (const child of this.state.layout.state.children) {
    //   if (child instanceof VizPanel) {
    //     objects.push(child);
    //   }
    // }

    return objects;
  }

  public static switchTo(currentLayout: DashboardLayoutManager): TabsLayoutManager {
    const objects = currentLayout.getObjects();
    const children: SceneObject[] = [];

    for (let obj of objects) {
      if (obj instanceof VizPanel) {
        children.push(obj.clone());
      }
    }

    return new TabsLayoutManager({
      tabLayouts: [
        new AutomaticGridLayoutManager({ layout: new SceneCSSGridLayout({ children }) }),
        new ManualGridLayoutManager({ layout: new SceneGridLayout({ children: [] }) }),
      ],
      tabTitles: ['Overview', 'Errors'],
      currentTab: 'Overview',
    });
  }

  public static Component = ({ model }: SceneComponentProps<TabsLayoutManager>) => {
    const { tabTitles, tabLayouts, currentTab } = model.useState();
    const currentTabIndex = tabTitles.findIndex((title) => title === currentTab);
    const currentLayout = tabLayouts[currentTabIndex];

    return (
      <LayoutEditChrome layoutManager={model}>
        <div style={{ display: 'flex', flex: '1 1 0', minHeight: 0, flexDirection: 'column' }}>
          <TabsBar>
            {tabTitles.map((title, index) => (
              <Tab
                key={index}
                title={title}
                label={title}
                onChangeTab={() => model.changeTab(title)}
                active={currentTab === title}
              />
            ))}
          </TabsBar>
          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0, paddingTop: '8px' }}>
            <currentLayout.Component model={currentLayout} />
          </div>
        </div>
      </LayoutEditChrome>
    );
  };
}

function TabsLayoutEditor({ layoutManager }: LayoutEditorProps<TabsLayoutManager>) {
  return (
    <Button
      fill="outline"
      icon="plus"
      onClick={() => {
        layoutManager.addNewTab();
      }}
    >
      Tab
    </Button>
  );
}
