import React from 'react';

import { SceneTimeRangeCompare, SceneComponentProps, VizPanel, sceneGraph } from '@grafana/scenes';
import { TimeCompareOptions } from '@grafana/schema';

import { getQueryRunnerFor } from '../utils/utils';

function hasTimeCompare(options: unknown): options is TimeCompareOptions {
  return options != null && typeof options === 'object' && 'timeCompare' in options;
}

export class CustomTimeRangeCompare extends SceneTimeRangeCompare {
  constructor(state: Partial<SceneTimeRangeCompare['state']> = {}) {
    super({
      ...state,
      compareWith: undefined,
      compareOptions: [],
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
          this._handleDisable(vizPanel);
        }
      })
    );
  }

  private _handleDisable(vizPanel: VizPanel) {
    // Only clear state if there's actually a comparison active
    if (this.state.compareWith) {
      this.setState({
        compareWith: undefined,
      });
      // Refresh queries to remove comparison data
      const queryRunner = getQueryRunnerFor(vizPanel);
      if (queryRunner) {
        queryRunner.runQueries();
      }
    }
  }

  static Component = function CustomTimeRangeCompareRenderer({ model }: SceneComponentProps<SceneTimeRangeCompare>) {
    const OriginalRenderer = SceneTimeRangeCompare.Component;

    // Get the parent VizPanel to check timeCompare option
    const vizPanel = sceneGraph.getAncestor(model, VizPanel);
    const { options } = vizPanel.useState();

    // Check if timeCompare is enabled
    const isTimeCompareEnabled = hasTimeCompare(options) && options.timeCompare;

    const Wrapper = React.forwardRef<HTMLDivElement, React.PropsWithChildren<{}>>((props, ref) => {
      React.useEffect(() => {
        const buttons = document.querySelectorAll('button');
        buttons.forEach((button) => {
          if (button.getAttribute('aria-label') === 'Enable time frame comparison') {
            const divs = button.querySelectorAll('div');
            divs.forEach((div) => {
              if (div.textContent?.trim() === 'Comparison') {
                div.style.display = 'none';
              }
            });
          }
        });
      }, []);

      return (
        <div
          ref={ref}
          {...props}
          style={{
            display: isTimeCompareEnabled ? 'block' : 'none',
          }}
        />
      );
    });

    return (
      <Wrapper>
        <OriginalRenderer model={model} />
      </Wrapper>
    );
  };
}
