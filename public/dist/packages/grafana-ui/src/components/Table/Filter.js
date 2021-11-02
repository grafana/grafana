import { __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { css, cx } from '@emotion/css';
import { stylesFactory, useStyles } from '../../themes';
import { Icon } from '../Icon/Icon';
import { FilterPopup } from './FilterPopup';
import { Popover } from '..';
export var Filter = function (_a) {
    var _b;
    var column = _a.column, field = _a.field, tableStyles = _a.tableStyles;
    var ref = useRef(null);
    var _c = __read(useState(false), 2), isPopoverVisible = _c[0], setPopoverVisible = _c[1];
    var styles = useStyles(getStyles);
    var filterEnabled = useMemo(function () { return Boolean(column.filterValue); }, [column.filterValue]);
    var onShowPopover = useCallback(function () { return setPopoverVisible(true); }, [setPopoverVisible]);
    var onClosePopover = useCallback(function () { return setPopoverVisible(false); }, [setPopoverVisible]);
    if (!field || !((_b = field.config.custom) === null || _b === void 0 ? void 0 : _b.filterable)) {
        return null;
    }
    return (React.createElement("span", { className: cx(tableStyles.headerFilter, filterEnabled ? styles.filterIconEnabled : styles.filterIconDisabled), ref: ref, onClick: onShowPopover },
        React.createElement(Icon, { name: "filter" }),
        isPopoverVisible && ref.current && (React.createElement(Popover, { content: React.createElement(FilterPopup, { column: column, tableStyles: tableStyles, field: field, onClose: onClosePopover }), placement: "bottom-start", referenceElement: ref.current, show: true }))));
};
var getStyles = stylesFactory(function (theme) { return ({
    filterIconEnabled: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    label: filterIconEnabled;\n    color: ", ";\n  "], ["\n    label: filterIconEnabled;\n    color: ", ";\n  "])), theme.colors.textBlue),
    filterIconDisabled: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    label: filterIconDisabled;\n    color: ", ";\n  "], ["\n    label: filterIconDisabled;\n    color: ", ";\n  "])), theme.colors.textFaint),
}); });
var templateObject_1, templateObject_2;
//# sourceMappingURL=Filter.js.map