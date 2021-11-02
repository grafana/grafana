import { __assign, __read, __values } from "tslib";
import { isEqualWith } from 'lodash';
import { PanelModel } from '../state';
// Values that are safe to change without a full panel unmount/remount
// TODO: options and fieldConfig should also be supported
var mutableKeys = new Set(['gridPos', 'title', 'description', 'transparent']);
export function mergePanels(current, data) {
    var e_1, _a, e_2, _b, e_3, _c, e_4, _d;
    var panels = [];
    var info = {
        changed: false,
        actions: {
            add: [],
            remove: [],
            replace: [],
            update: [],
            noop: [],
        },
        panels: panels,
    };
    var nextId = 0;
    var inputPanels = new Map();
    try {
        for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
            var p = data_1_1.value;
            var id = p.id;
            if (!id) {
                if (!nextId) {
                    nextId = findNextPanelID([current, data]);
                }
                id = nextId++;
                p = __assign(__assign({}, p), { id: id }); // clone with new ID
            }
            inputPanels.set(id, p);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    try {
        for (var current_1 = __values(current), current_1_1 = current_1.next(); !current_1_1.done; current_1_1 = current_1.next()) {
            var panel = current_1_1.value;
            var target = inputPanels.get(panel.id);
            if (!target) {
                info.changed = true;
                info.actions.remove.push(panel.id);
                panel.destroy();
                continue;
            }
            inputPanels.delete(panel.id);
            // Fast comparison when working with the same panel objects
            if (target === panel) {
                panels.push(panel);
                info.actions.noop.push(panel.id);
                continue;
            }
            // Check if it is the same type
            if (panel.type === target.type) {
                var save = panel.getSaveModel();
                var isNoop = true;
                var doUpdate = false;
                try {
                    for (var _e = (e_3 = void 0, __values(Object.entries(target))), _f = _e.next(); !_f.done; _f = _e.next()) {
                        var _g = __read(_f.value, 2), key = _g[0], value = _g[1];
                        if (!isEqualWith(value, save[key], infinityEqualsNull)) {
                            info.changed = true;
                            isNoop = false;
                            if (mutableKeys.has(key)) {
                                panel[key] = value;
                                doUpdate = true;
                            }
                            else {
                                doUpdate = false;
                                break; // needs full replace
                            }
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_f && !_f.done && (_c = _e.return)) _c.call(_e);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
                if (isNoop) {
                    panels.push(panel);
                    info.actions.noop.push(panel.id);
                    continue;
                }
                if (doUpdate) {
                    panels.push(panel);
                    info.actions.update.push(panel.id);
                    continue;
                }
            }
            panel.destroy();
            var next = new PanelModel(target);
            next.key = next.id + "-update-" + Date.now(); // force react invalidate
            panels.push(next);
            info.changed = true;
            info.actions.replace.push(panel.id);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (current_1_1 && !current_1_1.done && (_b = current_1.return)) _b.call(current_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    try {
        // Add the new panels
        for (var _h = __values(inputPanels.values()), _j = _h.next(); !_j.done; _j = _h.next()) {
            var t = _j.value;
            panels.push(new PanelModel(t));
            info.changed = true;
            info.actions.add.push(t.id);
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (_j && !_j.done && (_d = _h.return)) _d.call(_h);
        }
        finally { if (e_4) throw e_4.error; }
    }
    return info;
}
// Since +- Infinity are saved as null in JSON, we need to make them equal here also
function infinityEqualsNull(a, b) {
    if (a == null && (b === Infinity || b === -Infinity || b == null)) {
        return true;
    }
    if (b == null && (a === Infinity || a === -Infinity || a == null)) {
        return true;
    }
    return undefined; // use default comparison
}
function findNextPanelID(args) {
    var e_5, _a, e_6, _b;
    var max = 0;
    try {
        for (var args_1 = __values(args), args_1_1 = args_1.next(); !args_1_1.done; args_1_1 = args_1.next()) {
            var panels = args_1_1.value;
            try {
                for (var panels_1 = (e_6 = void 0, __values(panels)), panels_1_1 = panels_1.next(); !panels_1_1.done; panels_1_1 = panels_1.next()) {
                    var panel = panels_1_1.value;
                    if (panel.id > max) {
                        max = panel.id;
                    }
                }
            }
            catch (e_6_1) { e_6 = { error: e_6_1 }; }
            finally {
                try {
                    if (panels_1_1 && !panels_1_1.done && (_b = panels_1.return)) _b.call(panels_1);
                }
                finally { if (e_6) throw e_6.error; }
            }
        }
    }
    catch (e_5_1) { e_5 = { error: e_5_1 }; }
    finally {
        try {
            if (args_1_1 && !args_1_1.done && (_a = args_1.return)) _a.call(args_1);
        }
        finally { if (e_5) throw e_5.error; }
    }
    return max + 1;
}
//# sourceMappingURL=panelMerge.js.map