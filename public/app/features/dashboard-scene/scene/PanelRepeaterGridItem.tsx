import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { config } from '@grafana/runtime';
import {
  VizPanel,
  SceneObjectBase,
  VariableDependencyConfig,
  SceneVariable,
  SceneGridLayout,
  SceneVariableSet,
  ConstantVariable,
  SceneComponentProps,
  SceneGridItemStateLike,
  SceneGridItemLike,
  sceneGraph,
  MultiValueVariable,
  VariableValueSingle,
} from '@grafana/scenes';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN } from 'app/core/constants';

interface PanelRepeaterGridItemState extends SceneGridItemStateLike {
  source: VizPanel;
  repeatedPanels?: VizPanel[];
  variableName: string;
  itemHeight?: number;
  repeatDirection?: RepeatDirection | string;
  maxPerRow?: number;
}

export type RepeatDirection = 'v' | 'h';

export class PanelRepeaterGridItem extends SceneObjectBase<PanelRepeaterGridItemState> implements SceneGridItemLike {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [this.state.variableName],
    onVariableUpdatesCompleted: this._onVariableChanged.bind(this),
  });

  private _ignoreNextStateChange = false;
  private _isWaitingForVariables = false;

  public constructor(state: PanelRepeaterGridItemState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    this._subs.add(this.subscribeToState((newState, prevState) => this._handleGridResize(newState, prevState)));

    // If we our variable is ready we can process repeats on activation
    if (sceneGraph.hasVariableDependencyInLoadingState(this)) {
      this._isWaitingForVariables = true;
    } else {
      this._performRepeat();
    }
  }

  private _onVariableChanged(changedVariables: Set<SceneVariable>, dependencyChanged: boolean): void {
    if (dependencyChanged) {
      this._performRepeat();
      return;
    }

    // If we are waiting for variables and the variable is no longer loading then we are ready to repeat as well
    if (this._isWaitingForVariables && !sceneGraph.hasVariableDependencyInLoadingState(this)) {
      this._isWaitingForVariables = false;
      this._performRepeat();
    }
  }

  /**
   * Uses the current repeat item count to calculate the user intended desired itemHeight
   */
  private _handleGridResize(newState: PanelRepeaterGridItemState, prevState: PanelRepeaterGridItemState) {
    if (this._ignoreNextStateChange) {
      this._ignoreNextStateChange = false;
      return;
    }

    const itemCount = this.state.repeatedPanels?.length ?? 1;
    const stateChange: Partial<PanelRepeaterGridItemState> = {};

    // Height changed
    if (newState.height !== prevState.height) {
      if (this.getRepeatDirection() === 'v') {
        const itemHeight = Math.ceil(newState.height! / itemCount);
        stateChange.itemHeight = itemHeight;
      } else {
        const rowCount = Math.ceil(itemCount / this.getMaxPerRow());
        stateChange.itemHeight = Math.ceil(newState.height! / rowCount);
      }
    }

    this._ignoreNextStateChange = true;
    this.setState(stateChange);
  }

  private _performRepeat() {
    const variable = sceneGraph.lookupVariable(this.state.variableName, this);
    if (!variable) {
      console.error('SceneGridItemRepeater: Variable not found');
      return;
    }

    if (!(variable instanceof MultiValueVariable)) {
      console.error('PanelRepeaterGridItem: Variable is not a MultiValueVariable');
      return;
    }

    console.log('perform repeat');
    const panelToRepeat = this.state.source;
    const { values, texts } = this.getVariableValues(variable);
    const repeatedPanels: VizPanel[] = [];

    // Loop through variable values and create repeates
    for (let index = 0; index < values.length; index++) {
      const clone = panelToRepeat.clone({
        $variables: new SceneVariableSet({
          variables: [
            new ConstantVariable({ name: variable.state.name, value: values[index], text: String(texts[index]) }),
          ],
        }),
        key: `${panelToRepeat.state.key}-clone-${index}`,
      });

      repeatedPanels.push(clone);
    }

    const direction = this.getRepeatDirection();
    const stateChange: Partial<PanelRepeaterGridItemState> = { repeatedPanels: repeatedPanels };
    const itemHeight = this.state.itemHeight ?? 10;
    const maxPerRow = this.getMaxPerRow();

    if (direction === 'h') {
      const rowCount = Math.ceil(repeatedPanels.length / maxPerRow);
      stateChange.height = rowCount * itemHeight;
    } else {
      stateChange.height = repeatedPanels.length * itemHeight;
    }

    this._ignoreNextStateChange = true;
    this.setState(stateChange);

    // In case we updated our height the grid layout needs to be update
    if (this.parent instanceof SceneGridLayout) {
      this.parent!.forceRender();
    }
  }

  private getVariableValues(variable: MultiValueVariable): {
    values: VariableValueSingle[];
    texts: VariableValueSingle[];
  } {
    const { value, text, options } = variable.state;

    if (variable.hasAllValue()) {
      return {
        values: options.map((o) => o.value),
        texts: options.map((o) => o.label),
      };
    }

    return {
      values: Array.isArray(value) ? value : [value],
      texts: Array.isArray(text) ? text : [text],
    };
  }

  private getMaxPerRow(): number {
    return this.state.maxPerRow ?? 4;
  }

  public getRepeatDirection(): RepeatDirection {
    return this.state.repeatDirection === 'v' ? 'v' : 'h';
  }

  public getClassName() {
    return 'panel-repeater-grid-item';
  }

  public static Component = ({ model }: SceneComponentProps<PanelRepeaterGridItem>) => {
    const { repeatedPanels, itemHeight } = model.useState();
    const itemCount = repeatedPanels?.length ?? 0;
    const layoutStyle = useLayoutStyle(model.getRepeatDirection(), itemCount, model.getMaxPerRow(), itemHeight ?? 10);

    if (!repeatedPanels) {
      return null;
    }

    return (
      <div className={layoutStyle}>
        {repeatedPanels.map((panel) => (
          <div className={itemStyle} key={panel.state.key}>
            <panel.Component model={panel} key={panel.state.key} />
          </div>
        ))}
      </div>
    );
  };
}

function useLayoutStyle(direction: RepeatDirection, itemCount: number, maxPerRow: number, itemHeight: number) {
  return useMemo(() => {
    const theme = config.theme2;

    // In mobile responsive layout we have to calculate the absolute height
    const mobileHeight = itemHeight * GRID_CELL_HEIGHT * itemCount + (itemCount - 1) * GRID_CELL_VMARGIN;

    if (direction === 'h') {
      const rowCount = Math.ceil(itemCount / maxPerRow);
      const columnCount = Math.ceil(itemCount / rowCount);

      return css({
        display: 'grid',
        height: '100%',
        width: '100%',
        gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
        gridTemplateRows: `repeat(${rowCount}, 1fr)`,
        gridColumnGap: theme.spacing(1),
        gridRowGap: theme.spacing(1),

        [theme.breakpoints.down('md')]: {
          display: 'flex',
          flexDirection: 'column',
          height: mobileHeight,
        },
      });
    }

    // Vertical is a bit simpler
    return css({
      display: 'flex',
      height: '100%',
      width: '100%',
      flexDirection: 'column',
      gap: theme.spacing(1),
      [theme.breakpoints.down('md')]: {
        height: mobileHeight,
      },
    });
  }, [direction, itemCount, maxPerRow, itemHeight]);
}

const itemStyle = css({
  display: 'flex',
  flexGrow: 1,
  position: 'relative',
});
