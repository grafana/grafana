import { LoadingState, PanelData } from '@grafana/data';

import { SceneItem, SceneItemBase, SceneLayoutItemChildState, SceneLayoutState } from './SceneItem';

interface RepeatOptions {
  item: SceneItem<any>;
}

export class ScenePanelRepeater extends SceneItemBase<RepeatOptions> {
  onMount() {
    super.onMount();

    this.subs.add(
      this.getData().subscribe({
        next: (data) => {
          if (data.data?.state === LoadingState.Done) {
            this.performRepeat(data.data);
          }
        },
      })
    );
  }

  performRepeat(data: PanelData) {
    // // assume parent is a layout
    // const parent = this.parent as SceneItem<SceneLayoutState>;
    // const children: Array<SceneItem<SceneLayoutItemChildState>> = [this];
    //
    // for (const series of data.series) {
    //   children.push()
    // }
  }

  Component = () => null;
}
