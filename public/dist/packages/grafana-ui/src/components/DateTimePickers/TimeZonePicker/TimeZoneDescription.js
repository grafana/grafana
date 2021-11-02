import { __makeTemplateObject } from "tslib";
import React, { useMemo } from 'react';
import { css } from '@emotion/css';
import { useTheme, stylesFactory } from '../../../themes';
export var TimeZoneDescription = function (_a) {
    var info = _a.info;
    var theme = useTheme();
    var styles = getStyles(theme);
    var description = useDescription(info);
    if (!info) {
        return null;
    }
    return React.createElement("div", { className: styles.description }, description);
};
var useDescription = function (info) {
    return useMemo(function () {
        var parts = [];
        if (!info) {
            return '';
        }
        if (info.countries.length > 0) {
            var country = info.countries[0];
            parts.push(country.name);
        }
        if (info.abbreviation) {
            parts.push(info.abbreviation);
        }
        return parts.join(', ');
    }, [info]);
};
var getStyles = stylesFactory(function (theme) {
    return {
        description: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      font-weight: normal;\n      font-size: ", ";\n      color: ", ";\n      white-space: normal;\n      text-overflow: ellipsis;\n    "], ["\n      font-weight: normal;\n      font-size: ", ";\n      color: ", ";\n      white-space: normal;\n      text-overflow: ellipsis;\n    "])), theme.typography.size.sm, theme.colors.textWeak),
    };
});
var templateObject_1;
//# sourceMappingURL=TimeZoneDescription.js.map