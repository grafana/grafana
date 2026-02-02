// BMC file
// for dashboard personalization - Time and Variable Change Behavior
import { Unsubscribable } from 'rxjs';

import { SceneObjectBase, SceneObjectState, SceneTimeRangeState, SceneVariableState } from '@grafana/scenes';

export interface TimeAndVariableChangeBehaviorState extends SceneObjectState {
  hasChanges?: boolean;
  hasTimeChanges?: boolean;
}

export class TimeAndVariableChangeBehavior extends SceneObjectBase<TimeAndVariableChangeBehaviorState> {
  static defaults: TimeAndVariableChangeBehaviorState = {
    hasChanges: false,
    hasTimeChanges: false,
  };

  // Track all subscriptions for cleanup
  private _subscriptions: Unsubscribable[] = [];

  constructor(state: TimeAndVariableChangeBehaviorState = TimeAndVariableChangeBehavior.defaults) {
    super(state);
    this.addActivationHandler(() => this._activationHandler());
  }

  // Handles activation: subscribes to time and variable changes
  private _activationHandler() {
    const { $timeRange, $variables } = this.getRoot().state;

    if ($timeRange) {
      this._subscriptions.push(
        $timeRange.subscribeToState((timeRange: SceneTimeRangeState) => {
          this.setState({ hasChanges: true, hasTimeChanges: true });
        })
      );
    }

    if ($variables) {
      $variables.state.variables.forEach((variable) => {
        this._subscriptions.push(
          variable.subscribeToState((variableState: SceneVariableState) => {
            this.setState({ hasChanges: true });
          })
        );
      });
    }

    // Return deactivation handler to clean up subscriptions
    return () => {
      this._subscriptions.forEach((unsub) => unsub.unsubscribe());
      this._subscriptions = [];
    };
  }
}
