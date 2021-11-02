import React, { useCallback } from 'react';
import { SeriesColorPicker } from '../ColorPicker/ColorPicker';
import { usePanelContext } from '../PanelChrome';
import { SeriesIcon } from './SeriesIcon';
/**
 * @internal
 */
export var VizLegendSeriesIcon = function (_a) {
    var seriesName = _a.seriesName, color = _a.color, gradient = _a.gradient, readonly = _a.readonly;
    var onSeriesColorChange = usePanelContext().onSeriesColorChange;
    var onChange = useCallback(function (color) {
        return onSeriesColorChange(seriesName, color);
    }, [seriesName, onSeriesColorChange]);
    if (seriesName && onSeriesColorChange && color && !readonly) {
        return (React.createElement(SeriesColorPicker, { color: color, onChange: onChange, enableNamedColors: true }, function (_a) {
            var ref = _a.ref, showColorPicker = _a.showColorPicker, hideColorPicker = _a.hideColorPicker;
            return (React.createElement(SeriesIcon, { color: color, className: "pointer", ref: ref, onClick: showColorPicker, onMouseLeave: hideColorPicker }));
        }));
    }
    return React.createElement(SeriesIcon, { color: color, gradient: gradient });
};
VizLegendSeriesIcon.displayName = 'VizLegendSeriesIcon';
//# sourceMappingURL=VizLegendSeriesIcon.js.map