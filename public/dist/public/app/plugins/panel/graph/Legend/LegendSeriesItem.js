import classNames from 'classnames';
import React, { PureComponent } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { SeriesColorPicker, SeriesIcon } from '@grafana/ui';
export const LEGEND_STATS = ['min', 'max', 'avg', 'current', 'total'];
export class LegendItem extends PureComponent {
    constructor(props) {
        super(props);
        this.onLabelClick = (e) => this.props.onLabelClick(this.props.series, e);
        this.onToggleAxis = () => {
            const yaxis = this.state.yaxis === 2 ? 1 : 2;
            const info = { alias: this.props.series.alias, yaxis: yaxis };
            this.setState({ yaxis: yaxis });
            this.props.onToggleAxis(info);
        };
        this.onColorChange = (color) => {
            this.props.onColorChange(this.props.series, color);
            // Because of PureComponent nature it makes only shallow props comparison and changing of series.color doesn't run
            // component re-render. In this case we can't rely on color, selected by user, because it may be overwritten
            // by series overrides. So we need to use forceUpdate() to make sure we have proper series color.
            this.forceUpdate();
        };
        this.state = {
            yaxis: this.props.series.yaxis,
        };
    }
    renderLegendValues() {
        const { series, asTable } = this.props;
        const legendValueItems = [];
        for (const valueName of LEGEND_STATS) {
            // @ts-ignore
            if (this.props[valueName]) {
                const valueFormatted = series.formatValue(series.stats[valueName]);
                legendValueItems.push(React.createElement(LegendValue, { key: valueName, valueName: valueName, value: valueFormatted, asTable: asTable, onValueClick: this.onLabelClick }));
            }
        }
        return legendValueItems;
    }
    render() {
        const { series, values, asTable, hidden } = this.props;
        const seriesOptionClasses = classNames({
            'graph-legend-series-hidden': hidden,
            'graph-legend-series--right-y': series.yaxis === 2,
        });
        const valueItems = values ? this.renderLegendValues() : [];
        const seriesLabel = (React.createElement(LegendSeriesLabel, { label: series.alias, color: series.color, yaxis: this.state.yaxis, onLabelClick: this.onLabelClick, onColorChange: this.onColorChange, onToggleAxis: this.onToggleAxis }));
        if (asTable) {
            return (React.createElement("tr", { className: `graph-legend-series ${seriesOptionClasses}` },
                React.createElement("td", { role: "gridcell" },
                    React.createElement("div", { className: "graph-legend-series__table-name" }, seriesLabel)),
                valueItems));
        }
        else {
            return (React.createElement("div", { className: `graph-legend-series ${seriesOptionClasses}` },
                seriesLabel,
                valueItems));
        }
    }
}
LegendItem.defaultProps = {
    asTable: false,
    hidden: false,
    onLabelClick: () => { },
    onColorChange: () => { },
    onToggleAxis: () => { },
};
class LegendSeriesLabel extends PureComponent {
    render() {
        const { label, color, yaxis } = this.props;
        const { onColorChange, onToggleAxis } = this.props;
        const onLabelClick = this.props.onLabelClick ? this.props.onLabelClick : () => { };
        return [
            React.createElement(LegendSeriesIcon, { key: "icon", color: color, yaxis: yaxis, onColorChange: onColorChange, onToggleAxis: onToggleAxis }),
            React.createElement("button", { type: "button", className: "graph-legend-alias pointer", title: label, key: "label", onClick: onLabelClick, "aria-label": selectors.components.Panels.Visualization.Graph.Legend.legendItemAlias(label) }, label),
        ];
    }
}
LegendSeriesLabel.defaultProps = {
    yaxis: undefined,
    onLabelClick: () => { },
};
class LegendSeriesIcon extends PureComponent {
    constructor() {
        super(...arguments);
        this.onColorChange = (color) => {
            const { onColorChange } = this.props;
            if (onColorChange) {
                onColorChange(color);
            }
        };
    }
    render() {
        return (React.createElement(SeriesColorPicker, { yaxis: this.props.yaxis, color: this.props.color, onChange: this.onColorChange, onToggleAxis: this.props.onToggleAxis, enableNamedColors: true }, ({ ref, showColorPicker, hideColorPicker }) => (React.createElement(SeriesIcon, { color: this.props.color, ref: ref, onClick: showColorPicker, onMouseLeave: hideColorPicker, className: "graph-legend-icon" }))));
    }
}
LegendSeriesIcon.defaultProps = {
    yaxis: undefined,
    onColorChange: () => { },
    onToggleAxis: () => { },
};
function LegendValue({ value, valueName, asTable, onValueClick }) {
    if (asTable) {
        return (React.createElement("td", { role: "gridcell", className: `graph-legend-value ${valueName}` }, value));
    }
    return React.createElement("div", { className: `graph-legend-value ${valueName}` }, value);
}
//# sourceMappingURL=LegendSeriesItem.js.map