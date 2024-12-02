import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { InlineField, InlineSwitch } from '@grafana/ui';

import { getWingmanOptionGroup, WingmanOptionGroup } from './wingman';

interface WingmanSceneState extends SceneObjectState {
  wingmanOptionGroup: WingmanOptionGroup[];
}

export class WingmanScene extends SceneObjectBase<WingmanSceneState> {
  constructor(props: Partial<WingmanSceneState>) {
    super({
      wingmanOptionGroup: getWingmanOptionGroup(),
    });
  }

  onWingmanOptionChanged = (groupIdx: number, optId: string, newValue: boolean) => {
    const updatedWingmanOptionGroup = [...this.state.wingmanOptionGroup];
    updatedWingmanOptionGroup[groupIdx].options[optId].enabled = newValue;
    this.setState({ wingmanOptionGroup: updatedWingmanOptionGroup });
  };

  public static Component = ({ model }: SceneComponentProps<WingmanScene>) => {
    const { wingmanOptionGroup } = model.useState();
    const { onWingmanOptionChanged } = model;
    return (
      <div>
        <div>11241 Metrics</div>
        {wingmanOptionGroup.map((group, groupIdx) => (
          <div key={group.title}>
            <h2>{group.title}</h2>
            {Object.entries(group.options).map(([key, opt]) => (
              <InlineField labelWidth={26} key={key} label={opt.label} tooltip={opt.description}>
                <InlineSwitch
                  value={opt.enabled}
                  onChange={() => onWingmanOptionChanged(groupIdx, key, !opt.enabled)}
                />
              </InlineField>
            ))}
          </div>
        ))}
      </div>
    );
  };
}
