import { useState } from 'react';

import { reportInteraction } from '@grafana/runtime';
import { SceneTimeRangeCompare, SceneComponentProps, VizPanel, sceneGraph } from '@grafana/scenes';
import { TimeCompareOptions } from '@grafana/schema';
import { Button, Dropdown, Menu } from '@grafana/ui';

function hasTimeCompare(options: unknown): options is TimeCompareOptions {
  return options != null && typeof options === 'object' && 'timeCompare' in options;
}

export class CustomTimeRangeCompare extends SceneTimeRangeCompare {
  private readonly parentOnCompareWithChanged: (compareWith: string) => void;

  constructor(state: Partial<SceneTimeRangeCompare['state']> = {}) {
    super({
      ...state,
      compareWith: undefined,
      compareOptions: [],
      hideCheckbox: true,
    });

    this.parentOnCompareWithChanged = this.onCompareWithChanged.bind(this);

    this.onCompareWithChanged = (compareWith: string) => {
      const vizPanel = sceneGraph.getAncestor(this, VizPanel);

      reportInteraction('panel_time_comparison', {
        viz_type: vizPanel?.getPlugin()?.meta.id || 'unknown',
        select_type: 'option_selected',
        option_type: compareWith,
      });

      this.parentOnCompareWithChanged(compareWith);
    };

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    // Subscribe to parent panel's options changes
    const vizPanel = sceneGraph.getAncestor(this, VizPanel);

    this._subs.add(
      vizPanel.subscribeToState((newState, prevState) => {
        const newTimeCompareEnabled = hasTimeCompare(newState.options) && newState.options.timeCompare;
        const prevTimeCompareEnabled = hasTimeCompare(prevState.options) && prevState.options.timeCompare;

        // Only act when transitioning from enabled to disabled
        if (prevTimeCompareEnabled && !newTimeCompareEnabled) {
          this._handleDisable();
        }
      })
    );
  }

  private _handleDisable() {
    // Only clear state if there's actually a comparison active
    if (this.state.compareWith) {
      this.setState({
        compareWith: undefined,
      });
    }
  }

  static Component = function CustomTimeRangeCompareRenderer({ model }: SceneComponentProps<SceneTimeRangeCompare>) {
    const vizPanel = sceneGraph.getAncestor(model, VizPanel);
    const { options } = vizPanel.useState();
    const { compareWith, compareOptions } = model.useState();
    const [isOpen, setIsOpen] = useState(false);

    const isTimeCompareEnabled = hasTimeCompare(options) && options.timeCompare;

    if (!isTimeCompareEnabled) {
      return <></>;
    }

    const currentOption = compareOptions.find((opt) => opt.value === compareWith);
    const displayLabel = currentOption ? `Comparison: ${currentOption.label}` : 'Comparison: None';

    const menu = (
      <Menu>
        {compareOptions.map((option) => (
          <Menu.Item
            key={option.value}
            label={option.label}
            active={option.value === compareWith}
            onClick={() => {
              model.onCompareWithChanged(option.value);
            }}
          />
        ))}
      </Menu>
    );

    return (
      <div className="show-on-hover">
        <Dropdown overlay={menu} placement="bottom-end" onVisibleChange={setIsOpen}>
          <Button variant="secondary" size="sm" icon={isOpen ? 'angle-up' : 'angle-down'} iconPlacement="right">
            {displayLabel}
          </Button>
        </Dropdown>
      </div>
    );
  };
}
