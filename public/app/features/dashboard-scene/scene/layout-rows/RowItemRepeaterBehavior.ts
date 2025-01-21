import { isEqual } from 'lodash';

import {
  LocalValueVariable,
  MultiValueVariable,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneVariable,
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueSingle,
  VizPanelMenu,
} from '@grafana/scenes';

import { getMultiVariableValues, getQueryRunnerFor } from '../../utils/utils';
import { repeatPanelMenuBehavior } from '../PanelMenuBehavior';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { DashboardRepeatsProcessedEvent } from '../types';

import { RowItem } from './RowItem';
import { RowsLayoutManager } from './RowsLayoutManager';

interface RowItemRepeaterBehaviorState extends SceneObjectState {
  variableName: string;
}

/**
 * This behavior will run an effect function when specified variables change
 */

export class RowItemRepeaterBehavior extends SceneObjectBase<RowItemRepeaterBehaviorState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [this.state.variableName],
    onVariableUpdateCompleted: () => {},
  });

  public isWaitingForVariables = false;
  private _prevRepeatValues?: VariableValueSingle[];
  private _clonedRows?: RowItem[];

  public constructor(state: RowItemRepeaterBehaviorState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  public notifyRepeatedPanelsWaitingForVariables(variable: SceneVariable) {
    const allRows = [this._getRow(), ...(this._clonedRows ?? [])];

    for (const row of allRows) {
      const vizPanels = row.state.layout.getVizPanels();

      for (const vizPanel of vizPanels) {
        const queryRunner = getQueryRunnerFor(vizPanel);
        if (queryRunner) {
          queryRunner.variableDependency?.variableUpdateCompleted(variable, false);
        }
      }
    }
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

  private _getRowClone(
    rowToRepeat: RowItem,
    index: number,
    value: VariableValueSingle,
    text: VariableValueSingle,
    variable: MultiValueVariable
  ): RowItem {
    const $variables = new SceneVariableSet({
      variables: [
        new LocalValueVariable({
          name: this.state.variableName,
          value,
          text: String(text),
          isMulti: variable.state.isMulti,
          includeAll: variable.state.includeAll,
        }),
      ],
    });

    const layout = rowToRepeat.getLayout().clone();

    if (layout instanceof DefaultGridLayoutManager) {
      layout.state.grid.setState({
        isDraggable: false,
      });

      layout.getVizPanels().forEach((panel) => {
        panel.setState({
          menu: new VizPanelMenu({
            $behaviors: [repeatPanelMenuBehavior],
          }),
        });
      });
    }

    if (index === 0) {
      rowToRepeat.setState({
        $variables,
        layout,
      });
      return rowToRepeat;
    }

    return rowToRepeat.clone({
      key: `${rowToRepeat.state.key}-clone-${value}`,
      $variables,
      $behaviors: [],
      layout,
      isClone: true,
    });
  }

  public performRepeat(force = false) {
    this.isWaitingForVariables = this._variableDependency.hasDependencyInLoadingState();

    if (this.isWaitingForVariables) {
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

    // when variable has no options (due to error or similar) it will not render any panels at all
    // adding a placeholder in this case so that there is at least empty panel that can display error
    const emptyVariablePlaceholderOption = {
      values: [''],
      texts: variable.hasAllValue() ? ['All'] : ['None'],
    };

    const variableValues = values.length ? values : emptyVariablePlaceholderOption.values;
    const variableTexts = texts.length ? texts : emptyVariablePlaceholderOption.texts;

    // Loop through variable values and create repeats
    for (let index = 0; index < variableValues.length; index++) {
      this._clonedRows.push(
        this._getRowClone(rowToRepeat, index, variableValues[index], variableTexts[index], variable)
      );
    }

    updateLayout(layout, this._clonedRows, rowToRepeat);

    // Used from dashboard url sync
    this.publishEvent(new DashboardRepeatsProcessedEvent({ source: this }), true);
  }

  public removeBehavior() {
    const row = this._getRow();
    const layout = this._getLayout();
    const rows = getRowsFilterOutRepeatClones(layout, row);

    layout.setState({ rows });

    // Remove behavior and the scoped local variable
    row.setState({ $behaviors: row.state.$behaviors!.filter((b) => b !== this), $variables: undefined });
  }
}

function updateLayout(layout: RowsLayoutManager, rows: RowItem[], rowToRepeat: RowItem) {
  const allRows = getRowsFilterOutRepeatClones(layout, rowToRepeat);
  const index = allRows.indexOf(rowToRepeat);

  if (index === -1) {
    throw new Error('RowItemRepeaterBehavior: Row not found in layout');
  }

  layout.setState({ rows: [...allRows.slice(0, index), ...rows, ...allRows.slice(index + 1)] });
}

function getRowsFilterOutRepeatClones(layout: RowsLayoutManager, rowToRepeat: RowItem) {
  return layout.state.rows.filter((row) => !row.state.key?.startsWith(`${rowToRepeat.state.key}-clone-`));
}
