import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';

interface WingmanSceneState extends SceneObjectState {}

export class WingmanScene extends SceneObjectBase<WingmanSceneState> {
  constructor(props: Partial<WingmanSceneState>) {
    super({});
  }

  public static Component = ({ model }: SceneComponentProps<WingmanScene>) => {
    return (
      <div>
        <div>wingman items will be here</div>
      </div>
    );
  };
}
