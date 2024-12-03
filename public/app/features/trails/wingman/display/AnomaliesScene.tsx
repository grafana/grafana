import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';

interface AnomaliesSceneState extends SceneObjectState {
  anomalies: string[];
}

export class AnomaliesScene extends SceneObjectBase<AnomaliesSceneState> {
  private metrics: string[] = [];

  constructor(state: Partial<AnomaliesSceneState>) {
    super({
      anomalies: [],
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  _onActivate() {
    this.setState({ anomalies: this.metrics });
  }

  public static Component = ({ model }: SceneComponentProps<AnomaliesScene>) => {
    const { anomalies } = model.useState();

    if (!anomalies.length) {
      return <div>No anomalies found</div>;
    }

    return <div></div>;
  };
}
