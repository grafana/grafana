import React, { CSSProperties } from 'react';

import { config } from '@grafana/runtime';
import {
  SceneObject,
  SceneObjectBase,
  VariableDependencyConfig,
  SceneVariable,
  SceneGridLayout,
  SceneVariableSet,
  ConstantVariable,
  SceneComponentProps,
  SceneGridItemStateLike,
  SceneGridItemLike,
} from '@grafana/scenes';
import { GRID_CELL_HEIGHT } from 'app/core/constants';

interface PanelRepeaterGridItemState extends SceneGridItemStateLike {
  source: SceneObject;
  repeats?: SceneObject[];
  variableName: string;
  itemWidth?: number;
  itemHeight?: number;
  repeatDirection?: 'v' | 'h';
  maxPerRow?: number;
}

export class PanelRepeaterGridItem extends SceneObjectBase<PanelRepeaterGridItemState> implements SceneGridItemLike {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [this.state.variableName],
    onVariableUpdatesCompleted: this._onVariableChanged.bind(this),
  });

  public constructor(state: PanelRepeaterGridItemState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {}

  private _onVariableChanged(changedVariables: Set<SceneVariable>): void {
    console.log('variable changed');
    for (const variable of changedVariables) {
      if (this.state.variableName === variable.state.name) {
        this._processRepeat(variable);
      }
    }
  }

  private _processRepeat(variable: SceneVariable) {
    const grid = this._getParentGrid();

    console.log(`SceneGridItemRepeater: _processRepeat ${variable.state.name}`);

    const panelToRepeat = this.state.source;
    const values = variable.getValue();
    const items: SceneObject[] = [];

    // Loop through variable values and create repeates
    if (Array.isArray(values)) {
      for (let index = 0; index < values.length; index++) {
        const clone = panelToRepeat.clone({
          $variables: new SceneVariableSet({
            variables: [new ConstantVariable({ name: variable.state.name, value: values[index] })],
          }),
          key: `${panelToRepeat.state.key}-clone-${index}`,
        });

        items.push(clone);
      }
    }

    const rowCount = Math.ceil(items.length / this.getMaxPerRow());
    const itemHeight = this.state.itemHeight ?? 10;

    this.setState({
      height: rowCount * itemHeight,
      width: 24,
      repeats: items,
    });

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

  public getContainerStyles(): CSSProperties {
    return {
      display: 'flex',
      height: '100%',
      width: '100%',
      flexWrap: 'wrap',
      gap: config.theme2.spacing(1),
    };
  }

  public getItemStyles(): CSSProperties {
    return {
      display: 'flex',
      minWidth: `${100 / this.getMaxPerRow()}%`,
      position: 'relative',
      flexGrow: 1,
    };
  }

  public static Component = ({ model }: SceneComponentProps<PanelRepeaterGridItem>) => {
    const { repeats } = model.useState();

    if (!repeats) {
      return null;
    }

    return (
      <div style={model.getContainerStyles()}>
        {repeats?.map((repeat) => (
          <div style={model.getItemStyles()} key={repeat.state.key}>
            <repeat.Component model={repeat} key={repeat.state.key} />
          </div>
        ))}
      </div>
    );
  };
}
