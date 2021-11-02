import { __values } from "tslib";
import React, { memo, useMemo, useCallback } from 'react';
import { FieldMatcherID, fieldMatchers } from '@grafana/data';
import { Select } from '../Select/Select';
/**
 * UI to configure "fields by frame refId"-matcher.
 * @public
 */
export var FieldsByFrameRefIdMatcher = memo(function (props) {
    var data = props.data, options = props.options, onChangeFromProps = props.onChange;
    var referenceIDs = useFrameRefIds(data);
    var selectOptions = useSelectOptions(referenceIDs);
    var onChange = useCallback(function (selection) {
        if (!selection.value || !referenceIDs.has(selection.value)) {
            return;
        }
        return onChangeFromProps(selection.value);
    }, [referenceIDs, onChangeFromProps]);
    var selectedOption = selectOptions.find(function (v) { return v.value === options; });
    return React.createElement(Select, { menuShouldPortal: true, value: selectedOption, options: selectOptions, onChange: onChange });
});
FieldsByFrameRefIdMatcher.displayName = 'FieldsByFrameRefIdMatcher';
/**
 * Registry item for UI to configure "fields by frame refId"-matcher.
 * @public
 */
export var fieldsByFrameRefIdItem = {
    id: FieldMatcherID.byFrameRefID,
    component: FieldsByFrameRefIdMatcher,
    matcher: fieldMatchers.get(FieldMatcherID.byFrameRefID),
    name: 'Fields returned by query',
    description: 'Set properties for fields from a specific query',
    optionsToLabel: function (options) { return options; },
};
var useFrameRefIds = function (data) {
    return useMemo(function () {
        var e_1, _a;
        var refIds = new Set();
        try {
            for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
                var frame = data_1_1.value;
                if (frame.refId) {
                    refIds.add(frame.refId);
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
        return refIds;
    }, [data]);
};
var useSelectOptions = function (displayNames) {
    return useMemo(function () {
        return Array.from(displayNames).map(function (n) { return ({
            value: n,
            label: n,
        }); });
    }, [displayNames]);
};
//# sourceMappingURL=FieldsByFrameRefIdMatcher.js.map