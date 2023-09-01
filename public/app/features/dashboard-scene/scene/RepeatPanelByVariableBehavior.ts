import {
  ConstantVariable,
  sceneGraph,
  SceneGridItem,
  SceneGridLayout,
  SceneObjectBase,
  SceneObjectState,
  SceneVariable,
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueSingle,
  VizPanel,
} from '@grafana/scenes';
import { GRID_COLUMN_COUNT } from 'app/core/constants';

export function repeatPanelByVariableBehavior(panel: VizPanel) {}

interface RepeatPanelByVariableBehaviorState extends SceneObjectState {
  variableName: string;
}

/**
 * This behavior will run an effect function when specified variables change
 */

export class RepeatPanelByVariableBehavior extends SceneObjectBase<RepeatPanelByVariableBehaviorState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [this.state.variableName],
    onVariableUpdatesCompleted: this._onVariableChanged.bind(this),
  });

  private _itemsAdded: Set<SceneGridItem> = new Set();

  private _onVariableChanged(changedVariables: Set<SceneVariable>): void {
    for (const variable of changedVariables) {
      if (this.state.variableName === variable.state.name) {
        this._processRepeat(variable);
      }
    }
  }

  private _processRepeat(variable: SceneVariable) {
    const grid = sceneGraph.getLayout(this);
    if (!(grid instanceof SceneGridLayout)) {
      console.error('RepeatPanelByVariableBehavior: Layout of type SceneGridLayout not found');
      return;
    }

    console.log(`RepeatPanelByVariableBehavior: _processRepeat ${variable.state.name}`);

    const items = grid.state.children as SceneGridItem[];
    const result: SceneGridItem[] = [];
    const itemRepeats: SceneGridItem[] = [];
    const itemToClone = this.parent as SceneGridItem;
    const values = variable.getValue();
    const maxPerRow = 4;

    // Loop through variable values and create repeates
    if (Array.isArray(values)) {
      for (let i = 0; i < values.length; i++) {
        const item = this.cloneItem(itemToClone, variable.state.name, values[i], i, values.length, maxPerRow);
        itemRepeats.push(item);
      }
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Ignore clones
      if (item.state.key!.indexOf(`${itemToClone.state.key}-clone-`) > -1) {
        continue;
      }

      // If have found the item to repeat
      if (item === this.parent) {
        result.push(...itemRepeats);
      } else {
        result.push(item);
      }
    }

    grid.setState({ children: result });
  }

  private cloneItem(
    sourceItem: SceneGridItem,
    variableName: string,
    value: VariableValueSingle,
    index: number,
    valueCount: number,
    maxPerRow: number
  ): SceneGridItem {
    const clone = index === 0 ? sourceItem : sourceItem.clone({ key: `${sourceItem.state.key}-clone-${index}` });

    clone.setState({
      $variables: new SceneVariableSet({
        variables: [new ConstantVariable({ name: variableName, value: value })],
      }),
    });

    console.log(`RepeatPanelByVariableBehavior. cloneItem setting ${variableName} = ${value}`);

    const x = sourceItem.state.x ?? 0;
    const width = Math.max(GRID_COLUMN_COUNT / valueCount, GRID_COLUMN_COUNT / maxPerRow);

    clone.setState({
      x: x + width * index,
    });

    return clone;
  }
}
