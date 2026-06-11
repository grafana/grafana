import { t } from '@grafana/i18n';
import {
  type SceneComponentProps,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { Tab } from '@grafana/ui';

import { PanelIntentEditor } from '../PanelIntentEditor';

import { type PanelDataPaneTab, type PanelDataTabHeaderProps, TabId } from './types';

export interface PanelDataContextTabState extends SceneObjectState {
  panelRef: SceneObjectRef<VizPanel>;
}

export class PanelDataContextTab extends SceneObjectBase<PanelDataContextTabState> implements PanelDataPaneTab {
  static Component = PanelDataContextTabRendered;
  public tabId = TabId.Context;

  public renderTab(props: PanelDataTabHeaderProps) {
    return (
      <Tab
        key={this.getTabLabel()}
        label={this.getTabLabel()}
        icon="ai-sparkle"
        active={props.active}
        onChangeTab={props.onChangeTab}
      />
    );
  }

  public getTabLabel() {
    return t('dashboard-scene.panel-data-context-tab.tab-label', 'Context');
  }
}

export function PanelDataContextTabRendered({ model }: SceneComponentProps<PanelDataContextTab>) {
  const panel = model.state.panelRef.resolve();
  return <PanelIntentEditor panel={panel} />;
}
