import { isEqual } from 'lodash';

import {
  LocalValueVariable,
  MultiValueVariable,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueSingle,
} from '@grafana/scenes';

import { isClonedKeyOf, getCloneKey } from '../../utils/clone';
import { getMultiVariableValues } from '../../utils/utils';
import { DashboardRepeatsProcessedEvent } from '../types/DashboardRepeatsProcessedEvent';

import { RowItem } from './RowItem';
import { RowsLayoutManager } from './RowsLayoutManager';

interface RowItemRepeaterBehaviorState extends SceneObjectState {
  variableName: string;
}

export class RowItemRepeaterBehavior extends SceneObjectBase<RowItemRepeaterBehaviorState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [this.state.variableName],
    onVariableUpdateCompleted: () => this.performRepeat(),
  });

  private _prevRepeatValues?: VariableValueSingle[];
  private _clonedRows?: RowItem[];

  public constructor(state: RowItemRepeaterBehaviorState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    this.performRepeat();
  }

  private _getRow(): RowItem {
    if (!(this.parent instanceof RowItem)) {
      throw new Error('RepeatedRowItemBehavior: Parent is not a RowItem');
    }

    return this.parent;
  }

  private _getLayout(): RowsLayoutManager {
    const layout = this._getRow().parent;

    if (!(layout instanceof RowsLayoutManager)) {
      throw new Error('RepeatedRowItemBehavior: Layout is not a RowsLayoutManager');
    }

    return layout;
  }

  public performRepeat(force = false) {
    if (this._variableDependency.hasDependencyInLoadingState()) {
      return;
    }

    const variable = sceneGraph.lookupVariable(this.state.variableName, this.parent?.parent!);

    if (!variable) {
      console.error('RepeatedRowItemBehavior: Variable not found');
      return;
    }

    if (!(variable instanceof MultiValueVariable)) {
      console.error('RepeatedRowItemBehavior: Variable is not a MultiValueVariable');
      return;
    }

    const rowToRepeat = this._getRow();
    const layout = this._getLayout();
    const { values, texts } = getMultiVariableValues(variable);

    // Do nothing if values are the same
    if (isEqual(this._prevRepeatValues, values) && !force) {
      return;
    }

    this._prevRepeatValues = values;

    this._clonedRows = [];

    const rowContent = rowToRepeat.getLayout();

    // when variable has no options (due to error or similar) it will not render any panels at all
    // adding a placeholder in this case so that there is at least empty panel that can display error
    const emptyVariablePlaceholderOption = {
      values: [''],
      texts: variable.hasAllValue() ? ['All'] : ['None'],
    };

    const variableValues = values.length ? values : emptyVariablePlaceholderOption.values;
    const variableTexts = texts.length ? texts : emptyVariablePlaceholderOption.texts;

    // Loop through variable values and create repeats
    for (let rowIndex = 0; rowIndex < variableValues.length; rowIndex++) {
      const isSourceRow = rowIndex === 0;
      const rowClone = isSourceRow ? rowToRepeat : rowToRepeat.clone({ $behaviors: [] });

      const rowCloneKey = getCloneKey(rowToRepeat.state.key!, rowIndex);

      rowClone.setState({
        key: rowCloneKey,
        $variables: new SceneVariableSet({
          variables: [
            new LocalValueVariable({
              name: this.state.variableName,
              value: variableValues[rowIndex],
              text: String(variableTexts[rowIndex]),
              isMulti: variable.state.isMulti,
              includeAll: variable.state.includeAll,
            }),
          ],
        }),
        layout: rowContent.cloneLayout?.(rowCloneKey, isSourceRow),
      });

      this._clonedRows.push(rowClone);
    }

    updateLayout(layout, this._clonedRows, rowToRepeat.state.key!);

    // Used from dashboard url sync
    this.publishEvent(new DashboardRepeatsProcessedEvent({ source: this }), true);
  }

  public removeBehavior() {
    const row = this._getRow();
    const layout = this._getLayout();
    const rows = getRowsFilterOutRepeatClones(layout, row.state.key!);

    layout.setState({ rows });

    // Remove behavior and the scoped local variable
    row.setState({ $behaviors: row.state.$behaviors!.filter((b) => b !== this), $variables: undefined });
  }
}

function updateLayout(layout: RowsLayoutManager, rows: RowItem[], rowKey: string) {
  const allRows = getRowsFilterOutRepeatClones(layout, rowKey);
  const index = allRows.findIndex((row) => row.state.key!.includes(rowKey));

  if (index === -1) {
    throw new Error('RowItemRepeaterBehavior: Row not found in layout');
  }

  layout.setState({ rows: [...allRows.slice(0, index), ...rows, ...allRows.slice(index + 1)] });
}

function getRowsFilterOutRepeatClones(layout: RowsLayoutManager, rowKey: string) {
  return layout.state.rows.filter((rows) => !isClonedKeyOf(rows.state.key!, rowKey));
}
