import { __values } from "tslib";
import { useMemo } from 'react';
import { getFieldDisplayName } from '@grafana/data';
import { getFieldTypeIcon } from '../../types';
/**
 * @internal
 */
export function frameHasName(name, names) {
    if (!name) {
        return false;
    }
    return names.display.has(name) || names.raw.has(name);
}
/**
 * Retuns the distinct names in a set of frames
 */
function getFrameFieldsDisplayNames(data, filter) {
    var e_1, _a, e_2, _b;
    var names = {
        display: new Set(),
        raw: new Set(),
        fields: new Map(),
    };
    try {
        for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
            var frame = data_1_1.value;
            try {
                for (var _c = (e_2 = void 0, __values(frame.fields)), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var field = _d.value;
                    if (filter && !filter(field)) {
                        continue;
                    }
                    var disp = getFieldDisplayName(field, frame, data);
                    names.display.add(disp);
                    names.fields.set(disp, field);
                    if (field.name && disp !== field.name) {
                        names.raw.add(field.name);
                        names.fields.set(field.name, field);
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return names;
}
/**
 * @internal
 */
export function useFieldDisplayNames(data, filter) {
    return useMemo(function () {
        return getFrameFieldsDisplayNames(data, filter);
    }, [data, filter]);
}
/**
 * @internal
 */
export function useSelectOptions(displayNames, currentName, firstItem) {
    return useMemo(function () {
        var e_3, _a, e_4, _b;
        var found = false;
        var options = [];
        if (firstItem) {
            options.push(firstItem);
        }
        try {
            for (var _c = __values(displayNames.display), _d = _c.next(); !_d.done; _d = _c.next()) {
                var name_1 = _d.value;
                if (!found && name_1 === currentName) {
                    found = true;
                }
                var field = displayNames.fields.get(name_1);
                options.push({
                    value: name_1,
                    label: name_1,
                    icon: field ? getFieldTypeIcon(field) : undefined,
                });
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_3) throw e_3.error; }
        }
        try {
            for (var _e = __values(displayNames.raw), _f = _e.next(); !_f.done; _f = _e.next()) {
                var name_2 = _f.value;
                if (!displayNames.display.has(name_2)) {
                    if (!found && name_2 === currentName) {
                        found = true;
                    }
                    options.push({
                        value: name_2,
                        label: name_2 + " (base field name)",
                    });
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
            }
            finally { if (e_4) throw e_4.error; }
        }
        if (currentName && !found) {
            options.push({
                value: currentName,
                label: currentName + " (not found)",
            });
        }
        return options;
    }, [displayNames, currentName, firstItem]);
}
//# sourceMappingURL=utils.js.map