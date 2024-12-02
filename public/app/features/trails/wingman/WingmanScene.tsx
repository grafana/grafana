import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { InlineField, InlineSwitch } from '@grafana/ui';

import { AllowedWingmanOptions, getWingmanOptionCollection, WingmanOptionCollection } from './wingman';

interface WingmanSceneState extends SceneObjectState {
  wingmanOptions: WingmanOptionCollection;
}

export class WingmanScene extends SceneObjectBase<WingmanSceneState> {
  constructor(props: Partial<WingmanSceneState>) {
    super({
      wingmanOptions: getWingmanOptionCollection(),
    });
  }

  onWingmanOptionChanged = (optId: AllowedWingmanOptions, newValue: boolean) => {
    const updatedWingmanOptions = { ...this.state.wingmanOptions };
    updatedWingmanOptions[optId].enabled = newValue;
    this.setState({ wingmanOptions: updatedWingmanOptions });
  };

  public static Component = ({ model }: SceneComponentProps<WingmanScene>) => {
    const { wingmanOptions } = model.useState();
    const { onWingmanOptionChanged } = model;
    return (
      <div>
        {Object.entries(wingmanOptions).map(([key, opt]) => (
          <InlineField labelWidth={26} key={key} label={opt.label} tooltip={opt.description}>
            <InlineSwitch
              value={opt.enabled}
              onChange={() => onWingmanOptionChanged(key as AllowedWingmanOptions, !opt.enabled)}
            />
          </InlineField>
        ))}
      </div>
    );
  };
}
