import { isEqual } from 'lodash';

import {
  MultiValueVariable,
  sceneGraph,
  SceneGridItemLike,
  SceneGridLayout,
  SceneGridRow,
  SceneObjectBase,
  SceneObjectState,
  VariableDependencyConfig,
  VariableValueSingle,
} from '@grafana/scenes';

import { getCloneKey, getLocalVariableValueSet } from '../../utils/clone';
import { getMultiVariableValues } from '../../utils/utils';

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

    const sub = layout.subscribeToState(() => {
      const repeatedRows = layout.state.children.filter(
        (child) => child instanceof SceneGridRow && child.state.repeatSourceKey === originalRow.state.key
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

        this.performRepeat(true);
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
            key: getCloneKey(rowToRepeat.state.key!, rowIndex),
            repeatSourceKey: rowToRepeat.state.key,
            y: (rowToRepeat.state.y ?? 0) + rowContentHeight * rowIndex + rowIndex,
            $behaviors: [],
            actions: undefined,
          });

      rowClone.setState({
        $variables: getLocalVariableValueSet(variable, variableValues[rowIndex], variableTexts[rowIndex]),
        children: [],
      });

      const children: SceneGridItemLike[] = [];

      for (const sourceItem of rowContent) {
        const sourceItemY = sourceItem.state.y ?? 0;
        const cloneItem = rowIndex > 0 ? sourceItem.clone() : sourceItem;
        const cloneItemY = sourceItemY + (rowContentHeight + 1) * rowIndex;

        // Update grid item keys on clone rows (not needed on source row)
        // Needed to not have duplicate grid items keys in the same grid
        if (rowIndex > 0) {
          cloneItem.setState({ y: cloneItemY, key: rowClone.state.key + sourceItem.state.key! });
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
  const index = allChildren.findIndex((child) => child instanceof SceneGridRow && child.state.key === rowKey);

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
    (child) => !(child instanceof SceneGridRow) || child.state.repeatSourceKey !== rowKey
  );
}
