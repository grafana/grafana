import { LocalValueVariable, MultiValueVariable, sceneGraph, SceneGridLayout, SceneGridRow, SceneObjectBase, SceneVariableSet, VariableDependencyConfig, } from '@grafana/scenes';
import { getMultiVariableValues } from '../utils/utils';
import { DashboardRepeatsProcessedEvent } from './types';
/**
 * This behavior will run an effect function when specified variables change
 */
export class RowRepeaterBehavior extends SceneObjectBase {
    constructor(state) {
        super(state);
        this._variableDependency = new VariableDependencyConfig(this, {
            variableNames: [this.state.variableName],
            onVariableUpdatesCompleted: this._onVariableChanged.bind(this),
        });
        this._isWaitingForVariables = false;
        this.addActivationHandler(() => this._activationHandler());
    }
    _activationHandler() {
        // If we our variable is ready we can process repeats on activation
        if (sceneGraph.hasVariableDependencyInLoadingState(this)) {
            this._isWaitingForVariables = true;
        }
        else {
            this._performRepeat();
        }
    }
    _onVariableChanged(changedVariables, dependencyChanged) {
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
    _performRepeat() {
        var _a, _b;
        const variable = sceneGraph.lookupVariable(this.state.variableName, (_a = this.parent) === null || _a === void 0 ? void 0 : _a.parent);
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
        const rowToRepeat = this.parent;
        const { values, texts } = getMultiVariableValues(variable);
        const rows = [];
        const rowContentHeight = getRowContentHeight(this.state.sources);
        let maxYOfRows = 0;
        // Loop through variable values and create repeates
        for (let index = 0; index < values.length; index++) {
            const children = [];
            // Loop through panels inside row
            for (const source of this.state.sources) {
                const sourceItemY = (_b = source.state.y) !== null && _b !== void 0 ? _b : 0;
                const itemY = sourceItemY + (rowContentHeight + 1) * index;
                const itemClone = source.clone({
                    key: `${source.state.key}-clone-${index}`,
                    y: itemY,
                });
                //Make sure all the child scene objects have unique keys
                ensureUniqueKeys(itemClone, index);
                children.push(itemClone);
                if (maxYOfRows < itemY + itemClone.state.height) {
                    maxYOfRows = itemY + itemClone.state.height;
                }
            }
            const rowClone = this.getRowClone(rowToRepeat, index, values[index], texts[index], rowContentHeight, children);
            rows.push(rowClone);
        }
        updateLayout(layout, rows, maxYOfRows, rowToRepeat);
        // Used from dashboard url sync
        this.publishEvent(new DashboardRepeatsProcessedEvent({ source: this }), true);
    }
    getRowClone(rowToRepeat, index, value, text, rowContentHeight, children) {
        var _a;
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
        const sourceRowY = (_a = rowToRepeat.state.y) !== null && _a !== void 0 ? _a : 0;
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
}
function getRowContentHeight(panels) {
    let maxY = 0;
    let minY = Number.MAX_VALUE;
    for (const panel of panels) {
        if (panel.state.y + panel.state.height > maxY) {
            maxY = panel.state.y + panel.state.height;
        }
        if (panel.state.y < minY) {
            minY = panel.state.y;
        }
    }
    return maxY - minY;
}
function updateLayout(layout, rows, maxYOfRows, rowToRepeat) {
    const allChildren = getLayoutChildrenFilterOutRepeatClones(layout, rowToRepeat);
    const index = allChildren.indexOf(rowToRepeat);
    if (index === -1) {
        throw new Error('RowRepeaterBehavior: Parent row not found in layout children');
    }
    const newChildren = [...allChildren.slice(0, index), ...rows, ...allChildren.slice(index + 1)];
    // Is there grid items after rows?
    if (allChildren.length > index + 1) {
        const childrenAfter = allChildren.slice(index + 1);
        const firstChildAfterY = childrenAfter[0].state.y;
        const diff = maxYOfRows - firstChildAfterY;
        for (const child of childrenAfter) {
            if (child.state.y < maxYOfRows) {
                child.setState({ y: child.state.y + diff });
            }
        }
    }
    layout.setState({ children: newChildren });
}
function getLayoutChildrenFilterOutRepeatClones(layout, rowToRepeat) {
    return layout.state.children.filter((child) => {
        var _a;
        if ((_a = child.state.key) === null || _a === void 0 ? void 0 : _a.startsWith(`${rowToRepeat.state.key}-clone-`)) {
            return false;
        }
        return true;
    });
}
function ensureUniqueKeys(item, rowIndex) {
    item.forEachChild((child) => {
        child.setState({ key: `${child.state.key}-row-${rowIndex}` });
        ensureUniqueKeys(child, rowIndex);
    });
}
//# sourceMappingURL=RowRepeaterBehavior.js.map