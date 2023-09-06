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

interface RepeatedRowBehaviorState extends SceneObjectState {
  variableName: string;
  sources: SceneGridItemLike[];
}

/**
 * This behavior will run an effect function when specified variables change
 */

export class RepeatedRowBehavior extends SceneObjectBase<RepeatedRowBehaviorState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [this.state.variableName],
    onVariableUpdatesCompleted: this._onVariableChanged.bind(this),
  });

  private _isWaitingForVariables = false;

  public constructor(state: RepeatedRowBehaviorState) {
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

    // Loop through variable values and create repeates
    for (let index = 0; index < values.length; index++) {
      const children: SceneGridItemLike[] = [];

      for (const source of this.state.sources) {
        const sourceItemY = source.state.y ?? 0;
        const itemClone = source.clone({
          key: `${source.state.key}-clone-${index}`,
          y: sourceItemY + rowContentHeight * index + index,
        });

        children.push(itemClone);
      }

      const rowClone = this.getRowClone(rowToRepeat, index, values[index], texts[index], rowContentHeight, children);

      rows.push(rowClone);
    }

    layout.setState({ children: rows });

    // In case we updated our height the grid layout needs to be update
    if (this.parent instanceof SceneGridLayout) {
      this.parent!.forceRender();
    }
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
