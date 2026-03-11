import { SceneComponentProps, SceneObjectBase, VizPanel, sceneGraph } from '@grafana/scenes';
import { PanelHeaderNotices } from 'app/features/dashboard/dashgrid/PanelHeader/PanelHeaderNotices';

import { getPanelIdForVizPanel } from '../utils/utils';
import { usePrevious } from 'react-use';

export class PanelNotices extends SceneObjectBase {
  static Component = PanelNoticesRenderer;

  constructor() {
    super({});
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    const panel = this.parent;
    if (!panel || !(panel instanceof VizPanel)) {
      throw new Error('PanelNotices can be used only as title items for VizPanel');
    }
  };

  public getPanel() {
    const panel = this.parent;

    if (panel && panel instanceof VizPanel) {
      return panel;
    }

    return null;
  }
}

function PanelNoticesRenderer({ model }: SceneComponentProps<PanelNotices>) {
  const panel = model.getPanel();
  const dataObject = sceneGraph.getData(model);
  const data = dataObject.useState();

  const prevSeries = usePrevious(data.data?.series);

  if (
    prevSeries != null &&
    prevSeries.length > 0 &&
    prevSeries !== data.data?.series &&
    prevSeries[0].fields[0].values !== data.data?.series[0].fields[0].values
  ) {
    for (let i = 0; i < prevSeries.length; i++) {
      let fields = prevSeries[i].fields;

      for (let i = 0; i < fields.length; i++) {
        fields[i].values.length = 0;
      }
    }

    prevSeries.length = 0;
  }

  if (!panel) {
    return null;
  }

  const panelId = getPanelIdForVizPanel(panel);

  if (data.data?.series) {
    return <PanelHeaderNotices frames={data.data.series} panelId={panelId} />;
  }

  return null;
}
