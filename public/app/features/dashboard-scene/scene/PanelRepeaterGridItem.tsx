import React, { CSSProperties } from 'react';

import { config } from '@grafana/runtime';
import {
  SceneObject as VizPanel,
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
} from '@grafana/scenes';

interface PanelRepeaterGridItemState extends SceneGridItemStateLike {
  source: VizPanel;
  repeatedPanels?: VizPanel[];
  variableName: string;
  itemWidth?: number;
  itemHeight?: number;
  repeatDirection?: RepeatDirection | string;
  maxPerRow?: number;
}

type RepeatDirection = 'v' | 'h';

export class PanelRepeaterGridItem extends SceneObjectBase<PanelRepeaterGridItemState> implements SceneGridItemLike {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [this.state.variableName],
    onVariableUpdatesCompleted: this._onVariableChanged.bind(this),
  });

  private _ignoreNextStateChange = false;

  public constructor(state: PanelRepeaterGridItemState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    this._subs.add(this.subscribeToState((newState, prevState) => this._handleGridResize(newState, prevState)));

    // If we our variable is ready we can process repeats on activation
    if (!sceneGraph.hasVariableDependencyInLoadingState(this)) {
      const variable = sceneGraph.lookupVariable(this.state.variableName, this);
      if (variable) {
        this._processRepeat(variable!);
      } else {
        console.error('SceneGridItemRepeater: Variable not found');
      }
    }
  }

  private _onVariableChanged(changedVariables: Set<SceneVariable>): void {
    console.log('variable changed');
    for (const variable of changedVariables) {
      if (this.state.variableName === variable.state.name) {
        this._processRepeat(variable);
      }
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

    // Width changed
    if (newState.width !== prevState.width) {
      if (this.getRepeatDirection() === 'v') {
        stateChange.itemWidth = newState.width!;
      } else {
        stateChange.itemWidth = newState.width! / this.getMaxPerRow();
      }
    }

    this._ignoreNextStateChange = true;
    this.setState(stateChange);
  }

  private _processRepeat(variable: SceneVariable) {
    const grid = this._getParentGrid();

    console.log(`SceneGridItemRepeater: _processRepeat ${variable.state.name}`);

    const panelToRepeat = this.state.source;
    const values = variable.getValue();
    const repeatedPanels: VizPanel[] = [];

    // Loop through variable values and create repeates
    if (Array.isArray(values)) {
      for (let index = 0; index < values.length; index++) {
        const clone = panelToRepeat.clone({
          $variables: new SceneVariableSet({
            variables: [new ConstantVariable({ name: variable.state.name, value: values[index] })],
          }),
          key: `${panelToRepeat.state.key}-clone-${index}`,
        });

        repeatedPanels.push(clone);
      }
    }

    const direction = this.getRepeatDirection();
    const stateChange: Partial<PanelRepeaterGridItemState> = { repeatedPanels: repeatedPanels };
    let itemWidth = this.state.itemWidth ?? 10;
    const itemHeight = this.state.itemHeight ?? 10;
    const maxPerRow = this.getMaxPerRow();
    const panelCount = repeatedPanels.length;

    if (direction === 'h') {
      const rowCount = Math.ceil(repeatedPanels.length / maxPerRow);

      // if we can distribute panels evenly do that
      if (panelCount % rowCount === 0) {
        itemWidth = panelCount / rowCount;
      }

      stateChange.height = rowCount * itemHeight;
      //stateChange.width = 24;
    } else {
      stateChange.height = repeatedPanels.length * itemHeight;
      stateChange.width = itemWidth;
    }

    this._ignoreNextStateChange = true;
    this.setState(stateChange);
    grid.forceRender();
  }

  private _getParentGrid(): SceneGridLayout {
    const grid = this.parent;
    if (!(grid instanceof SceneGridLayout)) {
      throw new Error('SceneGridItemRepeater: Layout of type SceneGridLayout not found');
    }

    return grid;
  }

  private getMaxPerRow(): number {
    return this.state.maxPerRow ?? 4;
  }

  private getRepeatDirection(): RepeatDirection {
    return this.state.repeatDirection === 'v' ? 'v' : 'h';
  }

  public getContainerStyles(): CSSProperties {
    const direction = this.getRepeatDirection();

    return {
      display: 'flex',
      height: '100%',
      width: '100%',
      flexWrap: 'wrap',
      flexDirection: direction === 'h' ? 'row' : 'column',
      gap: config.theme2.spacing(1),
    };
  }

  public getItemStyles(): CSSProperties {
    const direction = this.getRepeatDirection();

    if (direction === 'h') {
      return {
        display: 'flex',
        minWidth: `${100 / this.getMaxPerRow()}%`,
        position: 'relative',
        flexGrow: 1,
      };
    } else {
      return {
        display: 'flex',
        position: 'relative',
        flexGrow: 1,
      };
    }
  }

  public static Component = ({ model }: SceneComponentProps<PanelRepeaterGridItem>) => {
    const { repeatedPanels } = model.useState();

    if (!repeatedPanels) {
      return null;
    }

    return (
      <div style={model.getContainerStyles()}>
        {repeatedPanels.map((panel) => (
          <div style={model.getItemStyles()} key={panel.state.key}>
            <panel.Component model={panel} key={panel.state.key} />
          </div>
        ))}
      </div>
    );
  };
}
