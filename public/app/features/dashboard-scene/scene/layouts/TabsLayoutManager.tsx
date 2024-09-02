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

import { DefaultGridLayoutManager } from './DefaultGrid/DefaultGridLayoutManager';
import { LayoutEditChrome } from './LayoutEditChrome';
import { ResponsiveGridLayoutManager } from './ResponsiveGrid/ResponsiveGridLayoutManager';
import {
  DashboardLayoutManager,
  LayoutRegistryItem,
  LayoutEditorProps,
  LayoutElementInfo,
  DashboardLayoutElement,
} from './types';

interface TabsLayoutManagerState extends SceneObjectState {
  tabLayouts: DashboardLayoutManager[];
  tabTitles: string[];
  currentTab?: string;
}

export class TabsLayoutManager extends SceneObjectBase<TabsLayoutManagerState> implements DashboardLayoutManager {
  cleanUpStateFromExplore?(): void {
    throw new Error('Method not implemented.');
  }
  addNewPanel(): VizPanel {
    throw new Error('Method not implemented.');
  }
  toSaveModel?() {
    throw new Error('Method not implemented.');
  }
  public getNextPanelId(): number {
    return 0;
  }

  public editModeChanged(isEditing: boolean): void {}

  public addNewTab(): void {
    this.setState({
      tabLayouts: [
        ...this.state.tabLayouts,
        new DefaultGridLayoutManager({
          layout: new SceneGridLayout({ children: [], isDraggable: true, isResizable: true }),
        }),
      ],
      tabTitles: [...this.state.tabTitles, `Tab ${this.state.tabTitles.length + 1}`],
    });
  }

  public changeTab(tab: string) {
    // TODO: Add url sync for current tab
    this.setState({ currentTab: tab });
  }

  public removeElement(element: DashboardLayoutElement) {}

  public renderEditor() {
    return <TabsLayoutEditor layoutManager={this} />;
  }

  public switchLayout(newLayout: DashboardLayoutManager) {
    const currentLayout = this.getCurrentLayout();
    const index = this.state.tabLayouts.indexOf(currentLayout);
    this.setState({ tabLayouts: this.state.tabLayouts.map((l, i) => (i === index ? newLayout : l)) });
  }

  public getCurrentLayout(): DashboardLayoutManager {
    const currentTab = this.state.currentTab;
    const currentTabIndex = this.state.tabTitles.findIndex((title) => title === currentTab);
    return this.state.tabLayouts[currentTabIndex];
  }

  public getLayoutId(): string {
    return 'tabs-layout';
  }

  public getDescriptor(): LayoutRegistryItem {
    return TabsLayoutManager.getDescriptor();
  }

  public static getDescriptor(): LayoutRegistryItem {
    return {
      name: 'Tabs',
      description: 'Top level tabs each with its own layout',
      id: 'tabs-layout',
      createFromLayout: TabsLayoutManager.createFromLayout,
    };
  }

  public getElements(): LayoutElementInfo[] {
    const elements: LayoutElementInfo[] = [];

    for (const childLayout of this.state.tabLayouts) {
      for (const child of childLayout.getElements()) {
        elements.push(child);
      }
    }

    return elements;
  }

  public static createFromLayout(layout: DashboardLayoutManager): TabsLayoutManager {
    const elements = layout.getElements();
    const children: SceneObject[] = [];

    for (let element of elements) {
      if (element.body instanceof VizPanel) {
        children.push(element.body.clone());
      }
    }

    return new TabsLayoutManager({
      tabLayouts: [layout],
      tabTitles: ['Tab 1'],
      currentTab: 'Tab 1',
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
