import { sortBy as _sortBy } from 'lodash';
import React, { PureComponent } from 'react';
import { CustomScrollbar, Icon } from '@grafana/ui';
import { LegendItem, LEGEND_STATS } from './LegendSeriesItem';
export class GraphLegend extends PureComponent {
    constructor(props) {
        super(props);
        this.onToggleSeries = (series, event) => {
            if (!this.props.onToggleSeries) {
                return;
            }
            let hiddenSeries = Object.assign({}, this.state.hiddenSeries);
            if (event.ctrlKey || event.metaKey || event.shiftKey) {
                if (hiddenSeries[series.alias]) {
                    delete hiddenSeries[series.alias];
                }
                else {
                    hiddenSeries[series.alias] = true;
                }
            }
            else {
                hiddenSeries = this.toggleSeriesExclusiveMode(series);
            }
            this.setState({ hiddenSeries: hiddenSeries });
            this.props.onToggleSeries(hiddenSeries);
        };
        this.state = {
            hiddenSeries: this.props.hiddenSeries,
        };
    }
    sortLegend() {
        let seriesList = [...this.props.seriesList] || [];
        const sortBy = this.props.sort;
        if (sortBy && this.props[sortBy] && this.props.alignAsTable) {
            seriesList = _sortBy(seriesList, (series) => {
                let sort = series.stats[sortBy];
                if (sort === null) {
                    sort = -Infinity;
                }
                return sort;
            });
            if (this.props.sortDesc) {
                seriesList = seriesList.reverse();
            }
        }
        return seriesList;
    }
    toggleSeriesExclusiveMode(series) {
        const hiddenSeries = Object.assign({}, this.state.hiddenSeries);
        if (hiddenSeries[series.alias]) {
            delete hiddenSeries[series.alias];
        }
        // check if every other series is hidden
        const alreadyExclusive = this.props.seriesList.every((value) => {
            if (value.alias === series.alias) {
                return true;
            }
            return hiddenSeries[value.alias];
        });
        if (alreadyExclusive) {
            // remove all hidden series
            this.props.seriesList.forEach((value) => {
                delete hiddenSeries[value.alias];
            });
        }
        else {
            // hide all but this serie
            this.props.seriesList.forEach((value) => {
                if (value.alias === series.alias) {
                    return;
                }
                hiddenSeries[value.alias] = true;
            });
        }
        return hiddenSeries;
    }
    render() {
        const { optionalClass, rightSide, sideWidth, sort, sortDesc, hideEmpty, hideZero, values, min, max, avg, current, total, renderCallback, } = this.props;
        const seriesValuesProps = { values, min, max, avg, current, total };
        const hiddenSeries = this.state.hiddenSeries;
        const seriesHideProps = { hideEmpty, hideZero };
        const sortProps = { sort, sortDesc };
        const seriesList = this.sortLegend().filter((series) => !series.hideFromLegend(seriesHideProps));
        const legendClass = `${this.props.alignAsTable ? 'graph-legend-table' : ''} ${optionalClass}`;
        // Set min-width if side style and there is a value, otherwise remove the CSS property
        // Set width so it works with IE11
        const width = rightSide && sideWidth ? sideWidth : undefined;
        const ieWidth = rightSide && sideWidth ? sideWidth - 1 : undefined;
        const legendStyle = {
            minWidth: width,
            width: ieWidth,
        };
        const legendProps = Object.assign(Object.assign({ seriesList: seriesList, hiddenSeries: hiddenSeries, onToggleSeries: this.onToggleSeries, onToggleAxis: this.props.onToggleAxis, onToggleSort: this.props.onToggleSort, onColorChange: this.props.onColorChange }, seriesValuesProps), sortProps);
        return (React.createElement("div", { className: `graph-legend-content ${legendClass}`, ref: renderCallback, style: legendStyle }, this.props.alignAsTable ? React.createElement(LegendTable, Object.assign({}, legendProps)) : React.createElement(LegendSeriesList, Object.assign({}, legendProps))));
    }
}
GraphLegend.defaultProps = {
    values: false,
    min: false,
    max: false,
    avg: false,
    current: false,
    total: false,
    alignAsTable: false,
    rightSide: false,
    sort: undefined,
    sortDesc: false,
    optionalClass: '',
    onToggleSeries: () => { },
    onToggleSort: () => { },
    onToggleAxis: () => { },
    onColorChange: () => { },
};
class LegendSeriesList extends PureComponent {
    render() {
        const { seriesList, hiddenSeries, values, min, max, avg, current, total } = this.props;
        const seriesValuesProps = { values, min, max, avg, current, total };
        return seriesList.map((series, i) => (React.createElement(LegendItem
        // This trick required because TimeSeries.id is not unique (it's just TimeSeries.alias).
        // In future would be good to make id unique across the series list.
        , Object.assign({ 
            // This trick required because TimeSeries.id is not unique (it's just TimeSeries.alias).
            // In future would be good to make id unique across the series list.
            key: `${series.id}-${i}`, series: series, hidden: hiddenSeries[series.alias] }, seriesValuesProps, { onLabelClick: this.props.onToggleSeries, onColorChange: this.props.onColorChange, onToggleAxis: this.props.onToggleAxis }))));
    }
}
class LegendTable extends PureComponent {
    constructor() {
        super(...arguments);
        this.onToggleSort = (stat) => {
            if (!this.props.onToggleSort) {
                return;
            }
            let sortDesc = this.props.sortDesc;
            let sortBy = this.props.sort;
            if (stat !== sortBy) {
                sortDesc = undefined;
            }
            // if already sort ascending, disable sorting
            if (sortDesc === false) {
                sortBy = undefined;
                sortDesc = undefined;
            }
            else {
                sortDesc = !sortDesc;
                sortBy = stat;
            }
            this.props.onToggleSort(sortBy, sortDesc);
        };
    }
    render() {
        const seriesList = this.props.seriesList;
        const { values, min, max, avg, current, total, sort, sortDesc, hiddenSeries } = this.props;
        const seriesValuesProps = { values, min, max, avg, current, total };
        if (!seriesList) {
            return null;
        }
        return (React.createElement("table", { role: "grid" },
            React.createElement("colgroup", null,
                React.createElement("col", { style: { width: '100%' } })),
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", { style: { textAlign: 'left' } }),
                    LEGEND_STATS.map((statName) => seriesValuesProps[statName] && (React.createElement(LegendTableHeaderItem, { key: statName, statName: statName, sort: sort, sortDesc: sortDesc, onClick: this.onToggleSort }))))),
            React.createElement("tbody", null, seriesList &&
                seriesList.map((series, i) => (React.createElement(LegendItem, Object.assign({ key: `${series.id}-${i}`, asTable: true, series: series, hidden: hiddenSeries[series.alias], onLabelClick: this.props.onToggleSeries, onColorChange: this.props.onColorChange, onToggleAxis: this.props.onToggleAxis }, seriesValuesProps)))))));
    }
}
class LegendTableHeaderItem extends PureComponent {
    constructor() {
        super(...arguments);
        this.onClick = () => {
            if (this.props.onClick) {
                this.props.onClick(this.props.statName);
            }
        };
    }
    render() {
        const { statName, sort, sortDesc } = this.props;
        return (React.createElement("th", { className: "pointer", onClick: this.onClick },
            statName,
            sort === statName && React.createElement(Icon, { name: sortDesc ? 'angle-down' : 'angle-up' })));
    }
}
export class Legend extends PureComponent {
    render() {
        return (React.createElement(CustomScrollbar, { hideHorizontalTrack: true },
            React.createElement(GraphLegend, Object.assign({}, this.props))));
    }
}
export default Legend;
//# sourceMappingURL=Legend.js.map