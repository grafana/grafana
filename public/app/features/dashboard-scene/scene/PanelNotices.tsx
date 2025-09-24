import { SceneComponentProps, SceneObjectBase, VizPanel, sceneGraph } from '@grafana/scenes';
import { PanelHeaderNotices } from 'app/features/dashboard/dashgrid/PanelHeader/PanelHeaderNotices';

import { getPanelIdForVizPanel, getQueryRunnerFor } from '../utils/utils';
import { PanelErrorNotice } from './PanelErrorNotice';

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

  if (!panel) {
    return null;
  }

  const panelId = getPanelIdForVizPanel(panel);

  // Check if there are any errors in the data
  const hasErrors = data.data?.series?.some((frame: any) => 
    frame.meta?.notices?.some((notice: any) => notice.severity === 'error')
  ) || data.data?.error;

  const onRetryQuery = () => {
    const queryRunner = getQueryRunnerFor(panel);
    if (queryRunner) {
      queryRunner.runQueries();
    }
  };

  if (data.data?.series) {
    return (
      <>
        <PanelHeaderNotices frames={data.data?.series} panelId={panelId} />
        {hasErrors && (
          <PanelErrorNotice 
            panel={panel}
            error={data.data?.error} 
            onRetry={onRetryQuery}
            frames={data.data?.series}
          />
        )}
      </>
    );
  }

  // Show error notice even if no series data but there's an error
  if (data.data?.error) {
    return (
      <PanelErrorNotice 
        panel={panel}
        error={data.data.error} 
        onRetry={onRetryQuery}
        frames={[]}
      />
    );
  }

  return null;
}
