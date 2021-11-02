import { __makeTemplateObject, __read } from "tslib";
import { IconButton, InlineLabel, Tooltip, useStyles2 } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { usePrevious } from 'react-use';
export function PromExemplarField(_a) {
    var _b;
    var datasource = _a.datasource, onChange = _a.onChange, query = _a.query;
    var _c = __read(useState(null), 2), error = _c[0], setError = _c[1];
    var styles = useStyles2(getStyles);
    var prevError = usePrevious(error);
    useEffect(function () {
        if (!datasource.exemplarsAvailable) {
            setError('Exemplars for this query are not available');
            onChange(false);
        }
        else if (query.instant && !query.range) {
            setError('Exemplars are not available for instant queries');
            onChange(false);
        }
        else {
            setError(null);
            // If error is cleared, we want to change exemplar to true
            if (prevError && !error) {
                onChange(true);
            }
        }
    }, [datasource.exemplarsAvailable, query.instant, query.range, onChange, prevError, error]);
    var iconButtonStyles = cx((_b = {},
        _b[styles.activeIcon] = !!query.exemplar,
        _b), styles.eyeIcon);
    return (React.createElement(InlineLabel, { width: "auto" },
        React.createElement(Tooltip, { content: error !== null && error !== void 0 ? error : '' },
            React.createElement("div", { className: styles.iconWrapper },
                "Exemplars",
                React.createElement(IconButton, { name: "eye", tooltip: !!query.exemplar ? 'Disable query with exemplars' : 'Enable query with exemplars', disabled: !!error, className: iconButtonStyles, onClick: function () {
                        onChange(!query.exemplar);
                    } })))));
}
function getStyles(theme) {
    return {
        eyeIcon: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-left: ", ";\n    "], ["\n      margin-left: ", ";\n    "])), theme.spacing(2)),
        activeIcon: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      color: ", ";\n    "], ["\n      color: ", ";\n    "])), theme.colors.primary.main),
        iconWrapper: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n    "], ["\n      display: flex;\n      align-items: center;\n    "]))),
    };
}
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=PromExemplarField.js.map