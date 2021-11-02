import { __values } from "tslib";
import React from 'react';
import NamedColorsGroup from './NamedColorsGroup';
import { VerticalGroup } from '../Layout/Layout';
import { ColorSwatch } from './ColorSwatch';
import { useTheme2 } from '../../themes/ThemeContext';
export var NamedColorsPalette = function (_a) {
    var e_1, _b;
    var color = _a.color, onChange = _a.onChange;
    var theme = useTheme2();
    var swatches = [];
    try {
        for (var _c = __values(theme.visualization.hues), _d = _c.next(); !_d.done; _d = _c.next()) {
            var hue = _d.value;
            swatches.push(React.createElement(NamedColorsGroup, { key: hue.name, selectedColor: color, hue: hue, onColorSelect: onChange }));
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return (React.createElement(VerticalGroup, { spacing: "md" },
        React.createElement("div", { style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gridRowGap: theme.spacing(2),
                gridColumnGap: theme.spacing(2),
                flexGrow: 1,
            } },
            swatches,
            React.createElement("div", null),
            React.createElement(ColorSwatch, { isSelected: color === 'transparent', color: 'rgba(0,0,0,0)', label: "Transparent", onClick: function () { return onChange('transparent'); } }),
            React.createElement(ColorSwatch, { isSelected: color === 'text', color: theme.colors.text.primary, label: "Text color", onClick: function () { return onChange('text'); } }))));
};
//# sourceMappingURL=NamedColorsPalette.js.map