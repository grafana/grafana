import { __makeTemplateObject } from "tslib";
import React, { useCallback, useMemo } from 'react';
import { getTagsAsSegmentsSelectables } from '../state/providers';
import { Button, SegmentAsync, useStyles2 } from '@grafana/ui';
import { actions } from '../state/actions';
import { css } from '@emotion/css';
import { TagEditor } from './TagEditor';
import { debounce } from 'lodash';
import { useDispatch } from '../state/context';
import { PlayButton } from './PlayButton';
/**
 * Renders all tags and a button allowing to add more tags.
 *
 * Options for tag names are reloaded while user is typing with backend taking care of auto-complete
 * (auto-complete cannot be implemented in front-end because backend returns only limited number of entries)
 */
export function TagsSection(_a) {
    var tags = _a.tags, state = _a.state;
    var dispatch = useDispatch();
    var styles = useStyles2(getStyles);
    // Options are reloaded while user is typing with backend taking care of auto-complete (auto-complete cannot be
    // implemented in front-end because backend returns only limited number of entries)
    var getTagsAsSegmentsOptions = useCallback(function (inputValue) {
        return getTagsAsSegmentsSelectables(state, inputValue || '');
    }, [state]);
    var debouncedGetTagsAsSegments = useMemo(function () { return debounce(getTagsAsSegmentsOptions, 200, { leading: true }); }, [
        getTagsAsSegmentsOptions,
    ]);
    return (React.createElement(React.Fragment, null,
        tags.map(function (tag, index) {
            return React.createElement(TagEditor, { key: index, tagIndex: index, tag: tag, state: state });
        }),
        tags.length && (React.createElement(SegmentAsync, { inputMinWidth: 150, onChange: function (value) {
                dispatch(actions.addNewTag({ segment: value.value }));
            }, loadOptions: debouncedGetTagsAsSegments, reloadOptionsOnChange: true, Component: React.createElement(Button, { icon: "plus", variant: "secondary", className: styles.button }) })),
        state.paused && React.createElement(PlayButton, null)));
}
function getStyles(theme) {
    return {
        button: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-right: ", ";\n    "], ["\n      margin-right: ", ";\n    "])), theme.spacing(0.5)),
    };
}
var templateObject_1;
//# sourceMappingURL=TagsSection.js.map