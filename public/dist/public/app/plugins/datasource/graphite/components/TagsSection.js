import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { useCallback, useMemo } from 'react';
import { Button, SegmentAsync, useStyles2 } from '@grafana/ui';
import { actions } from '../state/actions';
import { useDispatch } from '../state/context';
import { getTagsAsSegmentsSelectables } from '../state/providers';
import { PlayButton } from './PlayButton';
import { TagEditor } from './TagEditor';
/**
 * Renders all tags and a button allowing to add more tags.
 *
 * Options for tag names are reloaded while user is typing with backend taking care of auto-complete
 * (auto-complete cannot be implemented in front-end because backend returns only limited number of entries)
 */
export function TagsSection({ tags, state }) {
    const dispatch = useDispatch();
    const styles = useStyles2(getStyles);
    // Options are reloaded while user is typing with backend taking care of auto-complete (auto-complete cannot be
    // implemented in front-end because backend returns only limited number of entries)
    const getTagsAsSegmentsOptions = useCallback((inputValue) => {
        return getTagsAsSegmentsSelectables(state, inputValue || '');
    }, [state]);
    const debouncedGetTagsAsSegments = useMemo(() => debounce(getTagsAsSegmentsOptions, 200, { leading: true }), [getTagsAsSegmentsOptions]);
    return (React.createElement(React.Fragment, null,
        tags.map((tag, index) => {
            return React.createElement(TagEditor, { key: index, tagIndex: index, tag: tag, state: state });
        }),
        tags.length && (React.createElement(SegmentAsync, { inputMinWidth: 150, onChange: (value) => {
                dispatch(actions.addNewTag({ segment: value.value }));
            }, loadOptions: debouncedGetTagsAsSegments, reloadOptionsOnChange: true, Component: React.createElement(Button, { icon: "plus", variant: "secondary", className: styles.button, "aria-label": "Add new tag" }) })),
        state.paused && React.createElement(PlayButton, null)));
}
function getStyles(theme) {
    return {
        button: css `
      margin-right: ${theme.spacing(0.5)};
    `,
    };
}
//# sourceMappingURL=TagsSection.js.map