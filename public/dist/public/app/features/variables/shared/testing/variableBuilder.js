import { __rest } from "tslib";
import { cloneDeep } from 'lodash';
export class VariableBuilder {
    constructor(initialState) {
        const { id, index, global } = initialState, rest = __rest(initialState, ["id", "index", "global"]);
        this.variable = cloneDeep(Object.assign(Object.assign({}, rest), { name: rest.type }));
    }
    withName(name) {
        this.variable.name = name;
        return this;
    }
    withId(id) {
        this.variable.id = id;
        return this;
    }
    withRootStateKey(key) {
        this.variable.rootStateKey = key;
        return this;
    }
    build() {
        return this.variable;
    }
}
//# sourceMappingURL=variableBuilder.js.map