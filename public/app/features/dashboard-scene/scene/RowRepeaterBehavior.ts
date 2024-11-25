import { isEqual } from 'lodash';

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
  VizPanelMenu,
} from '@grafana/scenes';

import { getMultiVariableValues, getQueryRunnerFor } from '../utils/utils';

import { repeatPanelMenuBehavior } from './PanelMenuBehavior';
import { DashboardGridItem } from './layout-default/DashboardGridItem';
import { DashboardRepeatsProcessedEvent } from './types';

interface RowRepeaterBehaviorState extends SceneObjectState {
  variableName: string;
}

/**
 * This behavior will run an effect function when specified variables change
 */

export class RowRepeaterBehavior extends SceneObjectBase<RowRepeaterBehaviorState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [this.state.variableName],
    onVariableUpdateCompleted: () => {},
  });

  public isWaitingForVariables = false;
  private _prevRepeatValues?: VariableValueSingle[];
  private _clonedRows?: SceneGridRow[];

  public constructor(state: RowRepeaterBehaviorState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  public notifyRepeatedPanelsWaitingForVariables(variable: SceneVariable) {
    const allRows = [this._getRow(), ...(this._clonedRows ?? [])];

    for (const row of allRows) {
      for (const gridItem of row.state.children) {
        if (!(gridItem instanceof DashboardGridItem)) {
          continue;
        }

        const queryRunner = getQueryRunnerFor(gridItem.state.body);
        if (queryRunner) {
          queryRunner.variableDependency?.variableUpdateCompleted(variable, false);
        }
      }
    }
  }

  private _activationHandler() {
    this.performRepeat();

    const layout = this._getLayout();
    const originalRow = this._getRow();
    const filterKey = originalRow.state.key + '-clone-';

    const sub = layout.subscribeToState(() => {
      const repeatedRows = layout.state.children.filter(
        (child) => child instanceof SceneGridRow && child.state.key?.includes(filterKey)
      );

      // go through cloned rows, search for panels that are not clones
      for (const row of repeatedRows) {
        if (!(row instanceof SceneGridRow)) {
          continue;
        }

        // if no differences in row children compared to original, then no new panel added to clone
        if (row.state.children.length === originalRow.state.children.length) {
          continue;
        }

        //if there are differences, find the new panel, move it to the original and perform re peat
        const gridItem = row.state.children.find((gridItem) => !gridItem.state.key?.includes('clone'));
        if (gridItem) {
          const newGridItem = gridItem.clone();
          row.setState({ children: row.state.children.filter((item) => item !== gridItem) });

          // if we are moving a panel from the origin row to a clone row, we just return
          // this means we are modifying the origin row, retriggering the repeat and losing that panel
          if (originalRow.state.children.find((item) => item.state.key === newGridItem.state.key)) {
            return;
          }

          originalRow.setState({ children: [...originalRow.state.children, newGridItem] });
          this.performRepeat(true);
        }
      }
    });

    return () => {
      sub.unsubscribe();
    };
  }

  private _getRow(): SceneGridRow {
    if (!(this.parent instanceof SceneGridRow)) {
      throw new Error('RepeatedRowBehavior: Parent is not a SceneGridRow');
    }

    return this.parent;
  }

  private _getLayout(): SceneGridLayout {
    const layout = sceneGraph.getLayout(this);

    if (!(layout instanceof SceneGridLayout)) {
      throw new Error('RepeatedRowBehavior: Layout is not a SceneGridLayout');
    }

    return layout;
  }

  public performRepeat(force = false) {
    this.isWaitingForVariables = this._variableDependency.hasDependencyInLoadingState();

    if (this.isWaitingForVariables) {
      return;
    }

    const variable = sceneGraph.lookupVariable(this.state.variableName, this.parent?.parent!);

    if (!variable) {
      console.error('RepeatedRowBehavior: Variable not found');
      return;
    }

    if (!(variable instanceof MultiValueVariable)) {
      console.error('RepeatedRowBehavior: Variable is not a MultiValueVariable');
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
    const rowContent = rowToRepeat.state.children;
    const rowContentHeight = getRowContentHeight(rowContent);

    let maxYOfRows = 0;

    // when variable has no options (due to error or similar) it will not render any panels at all
    //  adding a placeholder in this case so that there is at least empty panel that can display error
    const emptyVariablePlaceholderOption = {
      values: [''],
      texts: variable.hasAllValue() ? ['All'] : ['None'],
    };

    const variableValues = values.length ? values : emptyVariablePlaceholderOption.values;
    const variableTexts = texts.length ? texts : emptyVariablePlaceholderOption.texts;

    // Loop through variable values and create repeates
    for (let index = 0; index < variableValues.length; index++) {
      const children: SceneGridItemLike[] = [];
      const localValue = variableValues[index];

      // Loop through panels inside row
      for (const source of rowContent) {
        const sourceItemY = source.state.y ?? 0;
        const itemY = sourceItemY + (rowContentHeight + 1) * index;
        const itemKey = index > 0 ? `${source.state.key}-clone-${localValue}` : source.state.key;
        const itemClone = source.clone({ key: itemKey, y: itemY });

        // Make sure all the child scene objects have unique keys
        // and add proper menu to the repeated panel
        if (index > 0) {
          ensureUniqueKeys(itemClone, localValue);

          //disallow clones to be dragged around or out of the row
          if (itemClone instanceof DashboardGridItem) {
            itemClone.setState({
              isDraggable: false,
            });

            itemClone.state.body.setState({
              menu: new VizPanelMenu({
                $behaviors: [repeatPanelMenuBehavior],
              }),
            });
          }
        }

        children.push(itemClone);

        if (maxYOfRows < itemY + itemClone.state.height!) {
          maxYOfRows = itemY + itemClone.state.height!;
        }
      }

      const rowClone = this.getRowClone(
        rowToRepeat,
        index,
        localValue,
        variableTexts[index],
        rowContentHeight,
        children,
        variable
      );
      this._clonedRows.push(rowClone);
    }

    updateLayout(layout, this._clonedRows, maxYOfRows, rowToRepeat);

    // Used from dashboard url sync
    this.publishEvent(new DashboardRepeatsProcessedEvent({ source: this }), true);
  }

  getRowClone(
    rowToRepeat: SceneGridRow,
    index: number,
    value: VariableValueSingle,
    text: VariableValueSingle,
    rowContentHeight: number,
    children: SceneGridItemLike[],
    variable: MultiValueVariable
  ): SceneGridRow {
    if (index === 0) {
      rowToRepeat.setState({
        // not activated
        $variables: new SceneVariableSet({
          variables: [
            new LocalValueVariable({
              name: this.state.variableName,
              value,
              text: String(text),
              isMulti: variable.state.isMulti,
              includeAll: variable.state.includeAll,
            }),
          ],
        }),
        children,
      });
      return rowToRepeat;
    }

    const sourceRowY = rowToRepeat.state.y ?? 0;

    return rowToRepeat.clone({
      key: `${rowToRepeat.state.key}-clone-${value}`,
      $variables: new SceneVariableSet({
        variables: [
          new LocalValueVariable({
            name: this.state.variableName,
            value,
            text: String(text),
            isMulti: variable.state.isMulti,
            includeAll: variable.state.includeAll,
          }),
        ],
      }),
      $behaviors: [],
      children,
      y: sourceRowY + rowContentHeight * index + index,
      actions: undefined,
    });
  }

  public removeBehavior() {
    const row = this._getRow();
    const layout = this._getLayout();
    const children = getLayoutChildrenFilterOutRepeatClones(this._getLayout(), this._getRow());

    layout.setState({ children: children });

    // Remove behavior and the scoped local variable
    row.setState({ $behaviors: row.state.$behaviors!.filter((b) => b !== this), $variables: undefined });
  }
}

function getRowContentHeight(panels: SceneGridItemLike[]): number {
  let maxY = 0;
  let minY = Number.MAX_VALUE;

  if (panels.length === 0) {
    return 0;
  }

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

    for (const child of childrenAfter) {
      child.setState({ y: child.state.y! + diff });

      if (child instanceof SceneGridRow) {
        for (const rowChild of child.state.children) {
          rowChild.setState({ y: rowChild.state.y! + diff });
        }
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

function ensureUniqueKeys(item: SceneGridItemLike, localValue: VariableValueSingle) {
  item.forEachChild((child) => {
    child.setState({ key: `${child.state.key}-clone-${localValue}` });
    ensureUniqueKeys(child, localValue);
  });
}
