import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { TIME_SERIES_TIME_FIELD_NAME, TIME_SERIES_VALUE_FIELD_NAME, } from '@grafana/data';
import { EventsCanvas, FIXED_UNIT } from '@grafana/ui';
import { ExemplarMarker } from './ExemplarMarker';
export const ExemplarsPlugin = ({ exemplars, timeZone, config, visibleSeries }) => {
    const plotInstance = useRef();
    const [lockedExemplarFieldIndex, setLockedExemplarFieldIndex] = useState();
    useLayoutEffect(() => {
        config.addHook('init', (u) => {
            plotInstance.current = u;
        });
    }, [config]);
    const mapExemplarToXYCoords = useCallback((dataFrame, dataFrameFieldIndex) => {
        var _a;
        const time = dataFrame.fields.find((f) => f.name === TIME_SERIES_TIME_FIELD_NAME);
        const value = dataFrame.fields.find((f) => f.name === TIME_SERIES_VALUE_FIELD_NAME);
        if (!time || !value || !plotInstance.current) {
            return undefined;
        }
        // Filter x, y scales out
        const yScale = (_a = Object.keys(plotInstance.current.scales).find((scale) => !['x', 'y'].some((key) => key === scale))) !== null && _a !== void 0 ? _a : FIXED_UNIT;
        const yMin = plotInstance.current.scales[yScale].min;
        const yMax = plotInstance.current.scales[yScale].max;
        let y = value.values[dataFrameFieldIndex.fieldIndex];
        // To not to show exemplars outside of the graph we set the y value to min if it is smaller and max if it is bigger than the size of the graph
        if (yMin != null && y < yMin) {
            y = yMin;
        }
        if (yMax != null && y > yMax) {
            y = yMax;
        }
        return {
            x: plotInstance.current.valToPos(time.values[dataFrameFieldIndex.fieldIndex], 'x'),
            y: plotInstance.current.valToPos(y, yScale),
        };
    }, []);
    const renderMarker = useCallback((dataFrame, dataFrameFieldIndex) => {
        const showMarker = visibleSeries !== undefined ? showExemplarMarker(visibleSeries, dataFrame, dataFrameFieldIndex) : true;
        const markerColor = visibleSeries !== undefined ? getExemplarColor(dataFrame, dataFrameFieldIndex, visibleSeries) : undefined;
        if (!showMarker) {
            return React.createElement(React.Fragment, null);
        }
        return (React.createElement(ExemplarMarker, { setClickedExemplarFieldIndex: setLockedExemplarFieldIndex, clickedExemplarFieldIndex: lockedExemplarFieldIndex, timeZone: timeZone, dataFrame: dataFrame, dataFrameFieldIndex: dataFrameFieldIndex, config: config, exemplarColor: markerColor }));
    }, [config, timeZone, visibleSeries, setLockedExemplarFieldIndex, lockedExemplarFieldIndex]);
    return (React.createElement(EventsCanvas, { config: config, id: "exemplars", events: exemplars, renderEventMarker: renderMarker, mapEventToXYCoords: mapExemplarToXYCoords }));
};
/**
 * Get labels that are currently visible/active in the legend
 */
export const getVisibleLabels = (config, frames) => {
    const visibleSeries = config.series.filter((series) => series.props.show);
    const visibleLabels = [];
    if (frames === null || frames === void 0 ? void 0 : frames.length) {
        visibleSeries.forEach((plotInstance) => {
            var _a, _b, _c, _d, _e, _f, _g;
            const frameIndex = (_b = (_a = plotInstance.props) === null || _a === void 0 ? void 0 : _a.dataFrameFieldIndex) === null || _b === void 0 ? void 0 : _b.frameIndex;
            const fieldIndex = (_d = (_c = plotInstance.props) === null || _c === void 0 ? void 0 : _c.dataFrameFieldIndex) === null || _d === void 0 ? void 0 : _d.fieldIndex;
            if (frameIndex !== undefined && fieldIndex !== undefined) {
                const field = (_e = frames[frameIndex]) === null || _e === void 0 ? void 0 : _e.fields[fieldIndex];
                if (field === null || field === void 0 ? void 0 : field.labels) {
                    // Note that this may be an empty object in the case of a metric being rendered with no labels
                    visibleLabels.push({
                        labels: field.labels,
                        color: (_g = (_f = plotInstance.props) === null || _f === void 0 ? void 0 : _f.lineColor) !== null && _g !== void 0 ? _g : '',
                    });
                }
            }
        });
    }
    return { labels: visibleLabels, totalSeriesCount: config.series.length };
};
/**
 * Get color of active series in legend
 */
const getExemplarColor = (dataFrame, dataFrameFieldIndex, visibleLabels) => {
    let exemplarColor;
    visibleLabels.labels.some((visibleLabel) => {
        const labelKeys = Object.keys(visibleLabel.labels);
        const fields = dataFrame.fields.filter((field) => {
            return labelKeys.find((labelKey) => labelKey === field.name);
        });
        if (fields.length) {
            const hasMatch = fields.every((field, index, fields) => {
                const value = field.values[dataFrameFieldIndex.fieldIndex];
                return visibleLabel.labels[field.name] === value;
            });
            if (hasMatch) {
                exemplarColor = visibleLabel.color;
                return true;
            }
        }
        return false;
    });
    return exemplarColor;
};
/**
 * Determine if the current exemplar marker is filtered by what series are selected in the legend UI
 */
const showExemplarMarker = (visibleSeries, dataFrame, dataFrameFieldIndex) => {
    let showMarker = false;
    // If all series are visible, don't filter any exemplars
    if (visibleSeries.labels.length === visibleSeries.totalSeriesCount) {
        showMarker = true;
    }
    else {
        visibleSeries.labels.some((visibleLabel) => {
            // Get the label names
            const labelKeys = Object.keys(visibleLabel.labels);
            // If there aren't any labels, the graph is only displaying a single series with exemplars, let's show all exemplars in this case as well
            if (Object.keys(visibleLabel.labels).length === 0) {
                showMarker = true;
            }
            else {
                // If there are labels, lets only show the exemplars with labels associated with series that are currently visible
                const fields = dataFrame.fields.filter((field) => {
                    return labelKeys.find((labelKey) => labelKey === field.name);
                });
                if (fields.length) {
                    // Check to see if at least one value matches each field
                    showMarker = visibleSeries.labels.some((series) => {
                        return Object.keys(series.labels).every((label) => {
                            const value = series.labels[label];
                            return fields.find((field) => field.values[dataFrameFieldIndex.fieldIndex] === value);
                        });
                    });
                }
            }
            return showMarker;
        });
    }
    return showMarker;
};
//# sourceMappingURL=ExemplarsPlugin.js.map