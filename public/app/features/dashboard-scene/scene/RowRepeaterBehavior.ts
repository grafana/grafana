import {
  LocalValueVariable,
  MultiValueVariable,
  sceneGraph,
  SceneGridItemLike,
  SceneGridLayout,
  SceneGridRow,
  SceneObjectBase,
  SceneObjectState,
  SceneVariable,
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueSingle,
} from '@grafana/scenes';

interface RowRepeaterBehaviorState extends SceneObjectState {
  variableName: string;
  sources: SceneGridItemLike[];
}

/**
 * This behavior will run an effect function when specified variables change
 */

export class RowRepeaterBehavior extends SceneObjectBase<RowRepeaterBehaviorState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [this.state.variableName],
    onVariableUpdatesCompleted: this._onVariableChanged.bind(this),
  });

  private _isWaitingForVariables = false;

  public constructor(state: RowRepeaterBehaviorState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
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

  private _performRepeat() {
    const variable = sceneGraph.lookupVariable(this.state.variableName, this.parent?.parent!);

    if (!variable) {
      console.error('RepeatedRowBehavior: Variable not found');
      return;
    }

    if (!(variable instanceof MultiValueVariable)) {
      console.error('RepeatedRowBehavior: Variable is not a MultiValueVariable');
      return;
    }

    if (!(this.parent instanceof SceneGridRow)) {
      console.error('RepeatedRowBehavior: Parent is not a SceneGridRow');
      return;
    }

    const layout = sceneGraph.getLayout(this);

    if (!(layout instanceof SceneGridLayout)) {
      console.error('RepeatedRowBehavior: Layout is not a SceneGridLayout');
      return;
    }

    const rowToRepeat = this.parent as SceneGridRow;
    const { values, texts } = this.getVariableValues(variable);
    const rows: SceneGridRow[] = [];
    const rowContentHeight = getRowContentHeight(this.state.sources);
    let maxYOfRows = 0;

    // Loop through variable values and create repeates
    for (let index = 0; index < values.length; index++) {
      const children: SceneGridItemLike[] = [];

      // Loop through panels inside row
      for (const source of this.state.sources) {
        const sourceItemY = source.state.y ?? 0;
        const itemY = sourceItemY + (rowContentHeight + 1) * index;

        // TODO this clone should not result in same keys deeper in the tree
        const itemClone = source.clone({
          key: `${source.state.key}-clone-${index}`,
          y: itemY,
        });

        children.push(itemClone);

        if (maxYOfRows < itemY + itemClone.state.height!) {
          maxYOfRows = itemY + itemClone.state.height!;
        }
      }

      const rowClone = this.getRowClone(rowToRepeat, index, values[index], texts[index], rowContentHeight, children);
      rows.push(rowClone);
    }

    updateLayout(layout, rows, maxYOfRows, rowToRepeat);
  }

  getRowClone(
    rowToRepeat: SceneGridRow,
    index: number,
    value: VariableValueSingle,
    text: VariableValueSingle,
    rowContentHeight: number,
    children: SceneGridItemLike[]
  ): SceneGridRow {
    if (index === 0) {
      rowToRepeat.setState({
        // not activated
        $variables: new SceneVariableSet({
          variables: [new LocalValueVariable({ name: this.state.variableName, value, text: String(text) })],
        }),
        children,
      });
      return rowToRepeat;
    }

    const sourceRowY = rowToRepeat.state.y ?? 0;

    return rowToRepeat.clone({
      key: `${rowToRepeat.state.key}-clone-${index}`,
      $variables: new SceneVariableSet({
        variables: [new LocalValueVariable({ name: this.state.variableName, value, text: String(text) })],
      }),
      $behaviors: [],
      children,
      y: sourceRowY + rowContentHeight * index + index,
    });
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
}

function getRowContentHeight(panels: SceneGridItemLike[]): number {
  let maxY = 0;
  let minY = Number.MAX_VALUE;

  for (const panel of panels) {
    if (panel.state.y! + panel.state.height! > maxY) {
      maxY = panel.state.y! + panel.state.height!;
    }
    if (panel.state.y! < minY) {
      minY = panel.state.y!;
    }
  }

  return maxY - minY;
}

function updateLayout(layout: SceneGridLayout, rows: SceneGridRow[], maxYOfRows: number, rowToRepeat: SceneGridRow) {
  const allChildren = getLayoutChildrenFilterOutRepeatClones(layout, rowToRepeat);
  const index = allChildren.indexOf(rowToRepeat);

  if (index === -1) {
    throw new Error('RowRepeaterBehavior: Parent row not found in layout children');
  }

  const newChildren = [...allChildren.slice(0, index), ...rows, ...allChildren.slice(index + 1)];

  // Is there grid items after rows?
  if (allChildren.length > index + 1) {
    const childrenAfter = allChildren.slice(index + 1);
    const firstChildAfterY = childrenAfter[0].state.y!;
    const diff = maxYOfRows - firstChildAfterY;

    console.log('maxYOfRows', maxYOfRows);
    console.log('Children after diff', diff);

    for (const child of childrenAfter) {
      if (child.state.y! < maxYOfRows) {
        child.setState({ y: child.state.y! + diff });
      }
    }
  }

  layout.setState({ children: newChildren });
}

function getLayoutChildrenFilterOutRepeatClones(layout: SceneGridLayout, rowToRepeat: SceneGridRow) {
  return layout.state.children.filter((child) => {
    if (child.state.key?.startsWith(`${rowToRepeat.state.key}-clone-`)) {
      return false;
    }

    return true;
  });
}
