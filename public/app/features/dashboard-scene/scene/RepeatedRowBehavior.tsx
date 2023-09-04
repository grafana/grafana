import {
  ConstantVariable,
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
  VizPanel,
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
    const variable = sceneGraph.lookupVariable(this.state.variableName, this);

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

    // Loop through variable values and create repeates
    for (let index = 0; index < values.length; index++) {
      const children: SceneGridItemLike[] = [];

      for (const source of this.state.sources) {
        const itemClone = source.clone({ key: `${source.state.key}-clone-${index}` });
        children.push(itemClone);
      }

      const rowClone = rowToRepeat.clone({
        key: `${rowToRepeat.state.key}-clone-${index}`,
        $variables: new SceneVariableSet({
          variables: [
            new ConstantVariable({ name: variable.state.name, value: values[index], text: String(texts[index]) }),
          ],
        }),
        children,
      });

      rows.push(rowClone);
    }

    layout.setState({ children: rows });

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
}
