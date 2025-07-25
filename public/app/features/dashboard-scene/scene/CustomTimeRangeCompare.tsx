import { SceneTimeRangeCompare, SceneComponentProps, VizPanel, sceneGraph } from '@grafana/scenes';
import { TimeCompareOptions } from '@grafana/schema';

function hasTimeCompare(options: unknown): options is TimeCompareOptions {
  return options != null && typeof options === 'object' && 'timeCompare' in options;
}

export class CustomTimeRangeCompare extends SceneTimeRangeCompare {
  constructor(state: Partial<SceneTimeRangeCompare['state']> = {}) {
    super({
      ...state,
      compareWith: undefined,
      compareOptions: [],
      hideCheckbox: true,
    });

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
    // Get the parent VizPanel to check timeCompare option
    const vizPanel = sceneGraph.getAncestor(model, VizPanel);
    const { options } = vizPanel.useState();

    // Check if timeCompare is enabled
    const isTimeCompareEnabled = hasTimeCompare(options) && options.timeCompare;

    if (!isTimeCompareEnabled) {
      return <></>;
    }

    return <SceneTimeRangeCompare.Component model={model} />;
  };
}
