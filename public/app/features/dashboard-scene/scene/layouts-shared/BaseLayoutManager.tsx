import { SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';

import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

export abstract class BaseLayoutManager<T extends SceneObjectState>
  extends SceneObjectBase<T>
  implements DashboardLayoutManager
{
  constructor(state: T) {
    super(state);
    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    this.trackIfEmpty();
  }

  public readonly isDashboardLayoutManager = true;

  abstract descriptor: Readonly<LayoutRegistryItem<{}>>;

  abstract addPanel(panel: VizPanel): void;
  abstract removePanel(panel: VizPanel): void;
  abstract duplicatePanel(panel: VizPanel): void;
  abstract getVizPanels(): VizPanel[];
  abstract getMaxPanelId(): number;
  abstract addNewRow(): void;
  abstract trackIfEmpty(): void;
}
