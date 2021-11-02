import { __values } from "tslib";
import { TIME_SERIES_VALUE_FIELD_NAME, FieldType, TIME_SERIES_TIME_FIELD_NAME } from '../types';
import { formatLabels } from '../utils/labels';
/**
 * Get an appropriate display title
 */
export function getFrameDisplayName(frame, index) {
    var e_1, _a;
    if (frame.name) {
        return frame.name;
    }
    // Single field with tags
    var valuesWithLabels = [];
    try {
        for (var _b = __values(frame.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
            var field = _c.value;
            if (field.labels && Object.keys(field.labels).length > 0) {
                valuesWithLabels.push(field);
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    if (valuesWithLabels.length === 1) {
        return formatLabels(valuesWithLabels[0].labels);
    }
    // list all the
    if (index === undefined) {
        return frame.fields
            .filter(function (f) { return f.type !== FieldType.time; })
            .map(function (f) { return getFieldDisplayName(f, frame); })
            .join(', ');
    }
    if (frame.refId) {
        return "Series (" + frame.refId + ")";
    }
    return "Series (" + index + ")";
}
export function getFieldDisplayName(field, frame, allFrames) {
    var _a;
    var existingTitle = (_a = field.state) === null || _a === void 0 ? void 0 : _a.displayName;
    if (existingTitle) {
        return existingTitle;
    }
    var displayName = calculateFieldDisplayName(field, frame, allFrames);
    field.state = field.state || {};
    field.state.displayName = displayName;
    return displayName;
}
/**
 * Get an appropriate display name. If the 'displayName' field config is set, use that.
 */
function calculateFieldDisplayName(field, frame, allFrames) {
    var _a, _b, _c;
    var hasConfigTitle = ((_a = field.config) === null || _a === void 0 ? void 0 : _a.displayName) && ((_b = field.config) === null || _b === void 0 ? void 0 : _b.displayName.length);
    var displayName = hasConfigTitle ? field.config.displayName : field.name;
    if (hasConfigTitle) {
        return displayName;
    }
    if (frame && ((_c = field.config) === null || _c === void 0 ? void 0 : _c.displayNameFromDS)) {
        return field.config.displayNameFromDS;
    }
    // This is an ugly exception for time field
    // For time series we should normally treat time field with same name
    // But in case it has a join source we should handle it as normal field
    if (field.type === FieldType.time && !field.labels) {
        return displayName !== null && displayName !== void 0 ? displayName : TIME_SERIES_TIME_FIELD_NAME;
    }
    var parts = [];
    var frameNamesDiffer = false;
    if (allFrames && allFrames.length > 1) {
        for (var i = 1; i < allFrames.length; i++) {
            var frame_1 = allFrames[i];
            if (frame_1.name !== allFrames[i - 1].name) {
                frameNamesDiffer = true;
                break;
            }
        }
    }
    var frameNameAdded = false;
    var labelsAdded = false;
    if (frameNamesDiffer && (frame === null || frame === void 0 ? void 0 : frame.name)) {
        parts.push(frame.name);
        frameNameAdded = true;
    }
    if (field.name && field.name !== TIME_SERIES_VALUE_FIELD_NAME) {
        parts.push(field.name);
    }
    if (field.labels && frame) {
        var singleLabelName = getSingleLabelName(allFrames !== null && allFrames !== void 0 ? allFrames : [frame]);
        if (!singleLabelName) {
            var allLabels = formatLabels(field.labels);
            if (allLabels) {
                parts.push(allLabels);
                labelsAdded = true;
            }
        }
        else if (field.labels[singleLabelName]) {
            parts.push(field.labels[singleLabelName]);
            labelsAdded = true;
        }
    }
    // if we have not added frame name and no labels, and field name = Value, we should add frame name
    if (frame && !frameNameAdded && !labelsAdded && field.name === TIME_SERIES_VALUE_FIELD_NAME) {
        if (frame.name && frame.name.length > 0) {
            parts.push(frame.name);
            frameNameAdded = true;
        }
    }
    if (parts.length) {
        displayName = parts.join(' ');
    }
    else if (field.name) {
        displayName = field.name;
    }
    else {
        displayName = TIME_SERIES_VALUE_FIELD_NAME;
    }
    // Ensure unique field name
    if (displayName === field.name) {
        displayName = getUniqueFieldName(field, frame);
    }
    return displayName;
}
function getUniqueFieldName(field, frame) {
    var dupeCount = 0;
    var foundSelf = false;
    if (frame) {
        for (var i = 0; i < frame.fields.length; i++) {
            var otherField = frame.fields[i];
            if (field === otherField) {
                foundSelf = true;
                if (dupeCount > 0) {
                    dupeCount++;
                    break;
                }
            }
            else if (field.name === otherField.name) {
                dupeCount++;
                if (foundSelf) {
                    break;
                }
            }
        }
    }
    if (dupeCount) {
        return field.name + " " + dupeCount;
    }
    return field.name;
}
/**
 * Checks all data frames and return name of label if there is only one label name in all frames
 */
function getSingleLabelName(frames) {
    var e_2, _a;
    var singleName = null;
    for (var i = 0; i < frames.length; i++) {
        var frame = frames[i];
        try {
            for (var _b = (e_2 = void 0, __values(frame.fields)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var field = _c.value;
                if (!field.labels) {
                    continue;
                }
                // yes this should be in!
                for (var labelKey in field.labels) {
                    if (singleName === null) {
                        singleName = labelKey;
                    }
                    else if (labelKey !== singleName) {
                        return null;
                    }
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
    }
    return singleName;
}
//# sourceMappingURL=fieldState.js.map