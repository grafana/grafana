import { __assign, __rest } from "tslib";
import { useFieldArray } from 'react-hook-form';
export var FieldArray = function (_a) {
    var name = _a.name, control = _a.control, children = _a.children, rest = __rest(_a, ["name", "control", "children"]);
    var _b = useFieldArray(__assign({ control: control, name: name }, rest)), fields = _b.fields, append = _b.append, prepend = _b.prepend, remove = _b.remove, swap = _b.swap, move = _b.move, insert = _b.insert;
    return children({ fields: fields, append: append, prepend: prepend, remove: remove, swap: swap, move: move, insert: insert });
};
//# sourceMappingURL=FieldArray.js.map