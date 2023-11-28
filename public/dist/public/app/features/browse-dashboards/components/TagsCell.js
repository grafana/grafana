import { css } from '@emotion/css';
import React from 'react';
import { TagList, useStyles2 } from '@grafana/ui';
export function TagsCell({ row: { original: data } }) {
    const styles = useStyles2(getStyles);
    const item = data.item;
    if (item.kind === 'ui') {
        if (item.uiKind === 'pagination-placeholder') {
            return React.createElement(TagList.Skeleton, null);
        }
        else {
            return null;
        }
    }
    if (!item.tags) {
        return null;
    }
    return React.createElement(TagList, { className: styles.tagList, tags: item.tags });
}
function getStyles(theme) {
    return {
        // TagList is annoying and has weird default alignment
        tagList: css({
            justifyContent: 'flex-start',
            flexWrap: 'nowrap',
        }),
    };
}
//# sourceMappingURL=TagsCell.js.map