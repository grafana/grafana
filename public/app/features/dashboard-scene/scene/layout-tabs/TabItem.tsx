import { useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { SceneObjectState, SceneObjectBase, SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Alert, Button, Input, Tab, TextLink, useElementSelection } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { RepeatRowSelect2 } from 'app/features/dashboard/components/RepeatRowSelect/RepeatRowSelect';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';

import { getDashboardSceneFor, getDefaultVizPanel, getQueryRunnerFor } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';
import { useLayoutCategory } from '../layouts-shared/DashboardLayoutSelector';
import { DashboardLayoutManager, EditableDashboardElement, LayoutParent } from '../types';

import { TabItemRepeaterBehavior } from './TabItemRepeaterBehavior';
import { TabsLayoutManager } from './TabsLayoutManager';

export interface TabItemState extends SceneObjectState {
  layout: DashboardLayoutManager;
  title?: string;
  isClone?: boolean;
}

export class TabItem extends SceneObjectBase<TabItemState> implements LayoutParent, EditableDashboardElement {
  public isEditableDashboardElement: true = true;

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const tab = this;

    const tabOptions = useMemo(() => {
      return new OptionsPaneCategoryDescriptor({
        title: 'Tab options',
        id: 'tab-options',
        isOpenDefault: true,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: 'Title',
          render: () => <TabTitleInput tab={tab} />,
        })
      );
    }, [tab]);

    const tabRepeatOptions = useMemo(() => {
      const dashboard = getDashboardSceneFor(tab);

      return new OptionsPaneCategoryDescriptor({
        title: 'Repeat options',
        id: 'tab-repeat-options',
        isOpenDefault: true,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: 'Variable',
          render: () => <TabRepeatSelect tab={tab} dashboard={dashboard} />,
        })
      );
    }, [tab]);

    const { layout } = this.useState();
    const layoutOptions = useLayoutCategory(layout);

    return [tabOptions, tabRepeatOptions, layoutOptions];
  }

  public getTypeName(): string {
    return 'Tab';
  }

  public onDelete = () => {
    const layout = sceneGraph.getAncestor(this, TabsLayoutManager);
    layout.removeTab(this);
  };

  public renderActions(): React.ReactNode {
    return (
      <>
        <Button size="sm" variant="secondary" icon="copy" />
        <Button size="sm" variant="destructive" fill="outline" onClick={this.onDelete} icon="trash-alt" />
      </>
    );
  }

  public getParentLayout(): TabsLayoutManager {
    return sceneGraph.getAncestor(this, TabsLayoutManager);
  }

  public getLayout(): DashboardLayoutManager {
    return this.state.layout;
  }

  public switchLayout(layout: DashboardLayoutManager): void {
    this.setState({ layout });
  }

  public onAddPanel = (vizPanel = getDefaultVizPanel()) => {
    this.getLayout().addPanel(vizPanel);
  };

  public onChangeTab = () => {
    const parentLayout = this.getParentLayout();
    parentLayout.changeTab(this);
  };

  public static Component = ({ model }: SceneComponentProps<TabItem>) => {
    const { title, key, isClone } = model.useState();
    const { currentTab } = model.getParentLayout().useState();
    const dashboard = getDashboardSceneFor(model);
    const { isEditing } = dashboard.useState();
    const titleInterpolated = sceneGraph.interpolate(model, title, undefined, 'text');
    const { isSelected, onSelect } = useElementSelection(key);

    return (
      <Tab
        className={!isClone && isSelected ? 'dashboard-selected-element' : undefined}
        label={titleInterpolated}
        active={model === currentTab}
        onPointerDown={(evt) => {
          evt.stopPropagation();

          if (isEditing && !isClone) {
            onSelect?.(evt);
          }

          if (model !== currentTab) {
            model.onChangeTab();
          }
        }}
      />
    );
  };
}

export function TabTitleInput({ tab }: { tab: TabItem }) {
  const { title } = tab.useState();

  return <Input value={title} onChange={(e) => tab.setState({ title: e.currentTarget.value })} />;
}

export function TabRepeatSelect({ tab, dashboard }: { tab: TabItem; dashboard: DashboardScene }) {
  const { layout, $behaviors } = tab.useState();

  let repeatBehavior: TabItemRepeaterBehavior | undefined = $behaviors?.find(
    (b) => b instanceof TabItemRepeaterBehavior
  );
  const { variableName } = repeatBehavior?.state ?? {};

  const isAnyPanelUsingDashboardDS = layout.getVizPanels().some((vizPanel) => {
    const runner = getQueryRunnerFor(vizPanel);
    return runner?.state.datasource?.uid === SHARED_DASHBOARD_QUERY;
  });

  return (
    <>
      <RepeatRowSelect2
        sceneContext={dashboard}
        repeat={variableName}
        onChange={(repeat) => {
          if (repeat) {
            // Remove repeat behavior if it exists to trigger repeat when adding new one
            if (repeatBehavior) {
              repeatBehavior.removeBehavior();
            }

            repeatBehavior = new TabItemRepeaterBehavior({ variableName: repeat });
            tab.setState({ $behaviors: [...(tab.state.$behaviors ?? []), repeatBehavior] });
            repeatBehavior.activate();
          } else {
            repeatBehavior?.removeBehavior();
          }
        }}
      />
      {isAnyPanelUsingDashboardDS ? (
        <Alert
          data-testid={selectors.pages.Dashboard.Rows.Repeated.ConfigSection.warningMessage}
          severity="warning"
          title=""
          topSpacing={3}
          bottomSpacing={0}
        >
          <p>
            <Trans i18nKey="dashboard.tabs-layout.tab.repeat.warning">
              Panels in this tab use the {{ SHARED_DASHBOARD_QUERY }} data source. These panels will reference the panel
              in the original tab, not the ones in the repeated tabs.
            </Trans>
          </p>
          <TextLink
            external
            href={
              'https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/create-dashboard/#configure-repeating-rows'
            }
          >
            <Trans i18nKey="dashboard.tabs-layout.tab.repeat.learn-more">Learn more</Trans>
          </TextLink>
        </Alert>
      ) : undefined}
    </>
  );
}
