import { debounce } from 'lodash';
import React, { useCallback, useMemo } from 'react';
import { Segment, SegmentAsync } from '@grafana/ui';
import { actions } from '../state/actions';
import { useDispatch } from '../state/context';
import { getTagOperatorsSelectables, getTagsSelectables, getTagValuesSelectables } from '../state/providers';
/**
 * Editor for a tag at given index. Allows changing the name of the tag, operator or value. Tag names are provided with
 * getTagsSelectables and contain only valid tags (it may depend on currently used tags). The dropdown for tag names is
 * also used for removing tag (with a special "--remove tag--" option provided by getTagsSelectables).
 *
 * Options for tag names and values are reloaded while user is typing with backend taking care of auto-complete
 * (auto-complete cannot be implemented in front-end because backend returns only limited number of entries)
 */
export function TagEditor({ tag, tagIndex, state }) {
    const dispatch = useDispatch();
    const getTagsOptions = useCallback((inputValue) => {
        return getTagsSelectables(state, tagIndex, inputValue || '');
    }, [state, tagIndex]);
    const debouncedGetTagsOptions = useMemo(() => debounce(getTagsOptions, 200, { leading: true }), [getTagsOptions]);
    const getTagValueOptions = useCallback((inputValue) => {
        return getTagValuesSelectables(state, tag, tagIndex, inputValue || '');
    }, [state, tagIndex, tag]);
    const debouncedGetTagValueOptions = useMemo(() => debounce(getTagValueOptions, 200, { leading: true }), [getTagValueOptions]);
    return (React.createElement(React.Fragment, null,
        React.createElement(SegmentAsync, { inputMinWidth: 150, value: tag.key, loadOptions: debouncedGetTagsOptions, reloadOptionsOnChange: true, onChange: (value) => {
                dispatch(actions.tagChanged({
                    tag: Object.assign(Object.assign({}, tag), { key: value.value }),
                    index: tagIndex,
                }));
            }, allowCustomValue: true }),
        React.createElement(Segment, { inputMinWidth: 50, value: tag.operator, options: getTagOperatorsSelectables(), onChange: (value) => {
                dispatch(actions.tagChanged({
                    tag: Object.assign(Object.assign({}, tag), { operator: value.value }),
                    index: tagIndex,
                }));
            } }),
        React.createElement(SegmentAsync, { inputMinWidth: 150, value: tag.value, loadOptions: debouncedGetTagValueOptions, reloadOptionsOnChange: true, onChange: (value) => {
                dispatch(actions.tagChanged({
                    tag: Object.assign(Object.assign({}, tag), { value: value.value }),
                    index: tagIndex,
                }));
            }, allowCustomValue: true })));
}
//# sourceMappingURL=TagEditor.js.map