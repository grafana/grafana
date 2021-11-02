import React, { useCallback } from 'react';
import { SeriesVisibilityChangeBehavior } from './types';
import { LegendDisplayMode } from '@grafana/schema';
import { VizLegendTable } from './VizLegendTable';
import { VizLegendList } from './VizLegendList';
import { DataHoverClearEvent, DataHoverEvent } from '@grafana/data';
import { SeriesVisibilityChangeMode, usePanelContext } from '../PanelChrome';
import { mapMouseEventToMode } from './utils';
/**
 * @public
 */
export function VizLegend(_a) {
    var items = _a.items, displayMode = _a.displayMode, sortKey = _a.sortBy, _b = _a.seriesVisibilityChangeBehavior, seriesVisibilityChangeBehavior = _b === void 0 ? SeriesVisibilityChangeBehavior.Isolate : _b, sortDesc = _a.sortDesc, onLabelClick = _a.onLabelClick, onToggleSort = _a.onToggleSort, placement = _a.placement, className = _a.className, itemRenderer = _a.itemRenderer, readonly = _a.readonly;
    var _c = usePanelContext(), eventBus = _c.eventBus, onToggleSeriesVisibility = _c.onToggleSeriesVisibility, onToggleLegendSort = _c.onToggleLegendSort;
    var onMouseEnter = useCallback(function (item, event) {
        eventBus === null || eventBus === void 0 ? void 0 : eventBus.publish({
            type: DataHoverEvent.type,
            payload: {
                raw: event,
                x: 0,
                y: 0,
                dataId: item.label,
            },
        });
    }, [eventBus]);
    var onMouseOut = useCallback(function (item, event) {
        eventBus === null || eventBus === void 0 ? void 0 : eventBus.publish({
            type: DataHoverClearEvent.type,
            payload: {
                raw: event,
                x: 0,
                y: 0,
                dataId: item.label,
            },
        });
    }, [eventBus]);
    var onLegendLabelClick = useCallback(function (item, event) {
        if (onLabelClick) {
            onLabelClick(item, event);
        }
        if (onToggleSeriesVisibility) {
            onToggleSeriesVisibility(item.label, seriesVisibilityChangeBehavior === SeriesVisibilityChangeBehavior.Hide
                ? SeriesVisibilityChangeMode.AppendToSelection
                : mapMouseEventToMode(event));
        }
    }, [onToggleSeriesVisibility, onLabelClick, seriesVisibilityChangeBehavior]);
    switch (displayMode) {
        case LegendDisplayMode.Table:
            return (React.createElement(VizLegendTable, { className: className, items: items, placement: placement, sortBy: sortKey, sortDesc: sortDesc, onLabelClick: onLegendLabelClick, onToggleSort: onToggleSort || onToggleLegendSort, onLabelMouseEnter: onMouseEnter, onLabelMouseOut: onMouseOut, itemRenderer: itemRenderer, readonly: readonly }));
        case LegendDisplayMode.List:
            return (React.createElement(VizLegendList, { className: className, items: items, placement: placement, onLabelMouseEnter: onMouseEnter, onLabelMouseOut: onMouseOut, onLabelClick: onLegendLabelClick, itemRenderer: itemRenderer, readonly: readonly }));
        default:
            return null;
    }
}
VizLegend.displayName = 'Legend';
//# sourceMappingURL=VizLegend.js.map