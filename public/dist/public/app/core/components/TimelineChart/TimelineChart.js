import React from 'react';
import { FALLBACK_COLOR, FieldType } from '@grafana/data';
import { PanelContextRoot, GraphNG, VizLayout, VizLegend, } from '@grafana/ui';
import { preparePlotConfigBuilder } from './utils';
const propsToDiff = ['rowHeight', 'colWidth', 'showValue', 'mergeValues', 'alignValue'];
export class TimelineChart extends React.Component {
    constructor() {
        super(...arguments);
        this.getValueColor = (frameIdx, fieldIdx, value) => {
            const field = this.props.frames[frameIdx].fields[fieldIdx];
            if (field.display) {
                const disp = field.display(value); // will apply color modes
                if (disp.color) {
                    return disp.color;
                }
            }
            return FALLBACK_COLOR;
        };
        this.prepConfig = (alignedFrame, allFrames, getTimeRange) => {
            this.panelContext = this.context;
            const { eventBus, sync } = this.panelContext;
            return preparePlotConfigBuilder(Object.assign(Object.assign({ frame: alignedFrame, getTimeRange,
                eventBus,
                sync, allFrames: this.props.frames }, this.props), { 
                // Ensure timezones is passed as an array
                timeZones: Array.isArray(this.props.timeZone) ? this.props.timeZone : [this.props.timeZone], 
                // When there is only one row, use the full space
                rowHeight: alignedFrame.fields.length > 2 ? this.props.rowHeight : 1, getValueColor: this.getValueColor }));
        };
        this.renderLegend = (config) => {
            const { legend, legendItems } = this.props;
            if (!config || !legendItems || !legend || legend.showLegend === false) {
                return null;
            }
            return (React.createElement(VizLayout.Legend, { placement: legend.placement },
                React.createElement(VizLegend, { placement: legend.placement, items: legendItems, displayMode: legend.displayMode, readonly: true })));
        };
    }
    render() {
        return (React.createElement(GraphNG, Object.assign({}, this.props, { fields: {
                x: (f) => f.type === FieldType.time,
                y: (f) => f.type === FieldType.number ||
                    f.type === FieldType.boolean ||
                    f.type === FieldType.string ||
                    f.type === FieldType.enum,
            }, prepConfig: this.prepConfig, propsToDiff: propsToDiff, renderLegend: this.renderLegend })));
    }
}
TimelineChart.contextType = PanelContextRoot;
//# sourceMappingURL=TimelineChart.js.map