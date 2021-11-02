import { __makeTemplateObject } from "tslib";
import React, { useCallback } from 'react';
import { css } from '@emotion/css';
import { useStyles } from '@grafana/ui';
import { TagBadge } from '../../../core/components/TagFilter/TagBadge';
export var AnnotationListItemTags = function (_a) {
    var tags = _a.tags, remove = _a.remove, onClick = _a.onClick;
    var styles = useStyles(getStyles);
    var onTagClicked = useCallback(function (e, tag) {
        e.stopPropagation();
        onClick(tag, remove);
    }, [onClick, remove]);
    if (!tags || !tags.length) {
        return null;
    }
    return (React.createElement(React.Fragment, null, tags.map(function (tag) {
        return (React.createElement("span", { key: tag, onClick: function (e) { return onTagClicked(e, tag); }, className: styles.pointer },
            React.createElement(TagBadge, { label: tag, removeIcon: Boolean(remove), count: 0 })));
    })));
};
function getStyles(theme) {
    return {
        pointer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      cursor: pointer;\n      padding: ", ";\n    "], ["\n      cursor: pointer;\n      padding: ", ";\n    "])), theme.spacing.xxs),
    };
}
var templateObject_1;
//# sourceMappingURL=AnnotationListItemTags.js.map