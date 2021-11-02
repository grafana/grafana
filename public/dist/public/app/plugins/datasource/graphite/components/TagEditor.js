import { __assign } from "tslib";
import React, { useCallback, useMemo } from 'react';
import { Segment, SegmentAsync } from '@grafana/ui';
import { actions } from '../state/actions';
import { getTagOperatorsSelectables, getTagsSelectables, getTagValuesSelectables } from '../state/providers';
import { debounce } from 'lodash';
import { useDispatch } from '../state/context';
/**
 * Editor for a tag at given index. Allows changing the name of the tag, operator or value. Tag names are provided with
 * getTagsSelectables and contain only valid tags (it may depend on currently used tags). The dropdown for tag names is
 * also used for removing tag (with a special "--remove tag--" option provided by getTagsSelectables).
 *
 * Options for tag names and values are reloaded while user is typing with backend taking care of auto-complete
 * (auto-complete cannot be implemented in front-end because backend returns only limited number of entries)
 */
export function TagEditor(_a) {
    var tag = _a.tag, tagIndex = _a.tagIndex, state = _a.state;
    var dispatch = useDispatch();
    var getTagsOptions = useCallback(function (inputValue) {
        return getTagsSelectables(state, tagIndex, inputValue || '');
    }, [state, tagIndex]);
    var debouncedGetTagsOptions = useMemo(function () { return debounce(getTagsOptions, 200, { leading: true }); }, [getTagsOptions]);
    var getTagValueOptions = useCallback(function (inputValue) {
        return getTagValuesSelectables(state, tag, tagIndex, inputValue || '');
    }, [state, tagIndex, tag]);
    var debouncedGetTagValueOptions = useMemo(function () { return debounce(getTagValueOptions, 200, { leading: true }); }, [
        getTagValueOptions,
    ]);
    return (React.createElement(React.Fragment, null,
        React.createElement(SegmentAsync, { inputMinWidth: 150, value: tag.key, loadOptions: debouncedGetTagsOptions, reloadOptionsOnChange: true, onChange: function (value) {
                dispatch(actions.tagChanged({
                    tag: __assign(__assign({}, tag), { key: value.value }),
                    index: tagIndex,
                }));
            }, allowCustomValue: true }),
        React.createElement(Segment, { inputMinWidth: 50, value: tag.operator, options: getTagOperatorsSelectables(), onChange: function (value) {
                dispatch(actions.tagChanged({
                    tag: __assign(__assign({}, tag), { operator: value.value }),
                    index: tagIndex,
                }));
            } }),
        React.createElement(SegmentAsync, { inputMinWidth: 150, value: tag.value, loadOptions: debouncedGetTagValueOptions, reloadOptionsOnChange: true, onChange: function (value) {
                dispatch(actions.tagChanged({
                    tag: __assign(__assign({}, tag), { value: value.value }),
                    index: tagIndex,
                }));
            }, allowCustomValue: true })));
}
//# sourceMappingURL=TagEditor.js.map