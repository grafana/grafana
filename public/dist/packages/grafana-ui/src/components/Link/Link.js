import { __assign, __rest } from "tslib";
import { locationUtil, textUtil } from '@grafana/data';
import React, { forwardRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
/**
 * @alpha
 */
export var Link = forwardRef(function (_a, ref) {
    var href = _a.href, children = _a.children, rest = __rest(_a, ["href", "children"]);
    var validUrl = locationUtil.stripBaseFromUrl(textUtil.sanitizeUrl(href !== null && href !== void 0 ? href : ''));
    return (
    // @ts-ignore
    React.createElement(RouterLink, __assign({ ref: ref, to: validUrl }, rest), children));
});
Link.displayName = 'Link';
//# sourceMappingURL=Link.js.map