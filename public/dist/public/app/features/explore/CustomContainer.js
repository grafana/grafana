import React, { useMemo } from 'react';
import { dateTime } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { PanelChrome, PanelContextProvider } from '@grafana/ui';
import { getPanelPluginMeta } from '../plugins/importPanelPlugin';
import { useExploreDataLinkPostProcessor } from './hooks/useExploreDataLinkPostProcessor';
export function CustomContainer({ width, height, timeZone, state, pluginId, frames, absoluteRange, splitOpenFn, eventBus, }) {
    const timeRange = useMemo(() => ({
        from: dateTime(absoluteRange.from),
        to: dateTime(absoluteRange.to),
        raw: {
            from: dateTime(absoluteRange.from),
            to: dateTime(absoluteRange.to),
        },
    }), [absoluteRange.from, absoluteRange.to]);
    const plugin = getPanelPluginMeta(pluginId);
    const dataLinkPostProcessor = useExploreDataLinkPostProcessor(splitOpenFn, timeRange);
    const panelContext = {
        dataLinkPostProcessor,
        eventBus,
        eventsScope: 'explore',
    };
    return (React.createElement(PanelContextProvider, { value: panelContext },
        React.createElement(PanelChrome, { title: plugin.name, width: width, height: height, loadingState: state }, (innerWidth, innerHeight) => (React.createElement(PanelRenderer, { data: { series: frames, state: state, timeRange }, pluginId: pluginId, title: "", width: innerWidth, height: innerHeight, timeZone: timeZone })))));
}
//# sourceMappingURL=CustomContainer.js.map