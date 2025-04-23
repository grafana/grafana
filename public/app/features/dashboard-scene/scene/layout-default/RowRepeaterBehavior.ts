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
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueSingle,
} from '@grafana/scenes';

import {
  containsCloneKey,
  getLastKeyFromClone,
  isClonedKeyOf,
  joinCloneKeys,
  getCloneKey,
  isClonedKey,
  getOriginalKey,
} from '../../utils/clone';
import { getMultiVariableValues } from '../../utils/utils';
import { DashboardRepeatsProcessedEvent } from '../types/DashboardRepeatsProcessedEvent';

interface RowRepeaterBehaviorState extends SceneObjectState {
  variableName: string;
}

export class RowRepeaterBehavior extends SceneObjectBase<RowRepeaterBehaviorState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [this.state.variableName],
    onVariableUpdateCompleted: () => this.performRepeat(),
  });

  private _prevRepeatValues?: VariableValueSingle[];
  private _clonedRows?: SceneGridRow[];

  public constructor(state: RowRepeaterBehaviorState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    this.performRepeat();

    const layout = this._getLayout();
    const originalRow = this._getRow();
    const originalRowNonClonedPanels = originalRow.state.children.filter((child) => !isClonedKey(child.state.key!));

    const sub = layout.subscribeToState(() => {
      const repeatedRows = layout.state.children.filter((child) =>
        isClonedKeyOf(child.state.key!, originalRow.state.key!)
      );

      // go through cloned rows, search for panels that are not clones
      for (const row of repeatedRows) {
        if (!(row instanceof SceneGridRow)) {
          continue;
        }

        const rowNonClonedPanels = row.state.children.filter((child) => !isClonedKey(child.state.key!));

        // if no differences in row children compared to original, then no new panel added to clone
        if (rowNonClonedPanels.length === originalRowNonClonedPanels.length) {
          continue;
        }

        // if there are differences, find the new panel, move it to the original and perform repeat
        const gridItem = rowNonClonedPanels.find((gridItem) => !containsCloneKey(gridItem.state.key!));

        if (gridItem) {
          const newGridItem = gridItem.clone();

          row.setState({ children: row.state.children.filter((item) => item !== gridItem) });

          // if we are moving a panel from the origin row to a clone row, we just return
          // this means we are modifying the origin row, re-triggering the repeat and losing that panel
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
    if (this._variableDependency.hasDependencyInLoadingState()) {
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
    // adding a placeholder in this case so that there is at least empty panel that can display error
    const emptyVariablePlaceholderOption = {
      values: [''],
      texts: variable.hasAllValue() ? ['All'] : ['None'],
    };

    const variableValues = values.length ? values : emptyVariablePlaceholderOption.values;
    const variableTexts = texts.length ? texts : emptyVariablePlaceholderOption.texts;

    for (let rowIndex = 0; rowIndex < variableValues.length; rowIndex++) {
      const isSourceRow = rowIndex === 0;
      const rowClone = isSourceRow
        ? rowToRepeat
        : rowToRepeat.clone({
            y: (rowToRepeat.state.y ?? 0) + rowContentHeight * rowIndex + rowIndex,
            $behaviors: [],
            actions: undefined,
          });

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
        children: [],
      });

      const children: SceneGridItemLike[] = [];

      for (const sourceItem of rowContent) {
        const sourceItemY = sourceItem.state.y ?? 0;

        const cloneItemKey = joinCloneKeys(rowCloneKey, getLastKeyFromClone(sourceItem.state.key!));
        const cloneItemY = sourceItemY + (rowContentHeight + 1) * rowIndex;
        const cloneItem =
          rowIndex > 0
            ? sourceItem.clone({
                isDraggable: false,
                isResizable: false,
              })
            : sourceItem;

        cloneItem.setState({
          key: cloneItemKey,
          y: cloneItemY,
        });

        if (rowIndex > 0) {
          ensureUniqueKeys(cloneItem, cloneItemKey);
        }

        children.push(cloneItem);

        if (maxYOfRows < cloneItemY + cloneItem.state.height!) {
          maxYOfRows = cloneItemY + cloneItem.state.height!;
        }
      }

      rowClone.setState({ children });

      this._clonedRows.push(rowClone);
    }

    updateLayout(layout, this._clonedRows, maxYOfRows, rowToRepeat.state.key!);

    // Used from dashboard url sync
    this.publishEvent(new DashboardRepeatsProcessedEvent({ source: this }), true);
  }

  public removeBehavior() {
    const row = this._getRow();
    const layout = this._getLayout();
    const children = getLayoutChildrenFilterOutRepeatClones(layout, row.state.key!);

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

function updateLayout(layout: SceneGridLayout, rows: SceneGridRow[], maxYOfRows: number, rowKey: string) {
  const allChildren = getLayoutChildrenFilterOutRepeatClones(layout, rowKey);
  const index = allChildren.findIndex(
    (child) => child instanceof SceneGridRow && getOriginalKey(child.state.key!) === getOriginalKey(rowKey)
  );

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

function getLayoutChildrenFilterOutRepeatClones(layout: SceneGridLayout, rowKey: string) {
  return layout.state.children.filter(
    (child) => !(child instanceof SceneGridRow) || !isClonedKeyOf(getLastKeyFromClone(child.state.key!), rowKey)
  );
}

function ensureUniqueKeys(item: SceneGridItemLike, ancestors: string) {
  item.forEachChild((child) => {
    const key = joinCloneKeys(ancestors, child.state.key!);
    child.setState({ key });
    ensureUniqueKeys(child, key);
  });
}
