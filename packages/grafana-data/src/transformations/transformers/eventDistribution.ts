import { map } from 'rxjs/operators';

import { MutableDataFrame } from '../../dataframe/MutableDataFrame';
import { sortDataFrame } from '../../dataframe/processDataFrame';
import { isTimeSeriesFrames } from '../../dataframe/utils';
import {
    Field,
    FieldType,
} from '../../types/dataFrame';
import { DataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

export interface EventDistributionTransformerOptions {
    // No options needed - time field is always oodle_event_time_epoch_ms
}

const timeFieldName = 'oodle_event_time_epoch_ms';

export const eventDistributionTransformer: DataTransformerInfo<EventDistributionTransformerOptions> = {
    id: DataTransformerID.eventDistribution,
    name: 'Event Distribution',
    description: 'Extract time series events and distribute them by time, converting labels to columns.',
    defaultOptions: {},
    operator: (options) => (source) =>
        source.pipe(
            map((data) => {
                if (!Array.isArray(data) || data.length === 0) {
                    return [];
                }

                data = data.filter((frame) => frame.length > 0);
                if (!isTimeSeriesFrames(data)) {
                    return [];
                }

                // Helper function to create label set key
                const createLabelSetKey = (labels: Record<string, string>) => {
                    const filteredLabels = Object.entries(labels)
                        .filter(([key]) => key !== timeFieldName)
                        .sort(([a], [b]) => a.localeCompare(b));

                    if (filteredLabels.length === 0) {
                        return '';
                    }

                    if (filteredLabels.length === 1) {
                        // If there's only one label, use just the value
                        return filteredLabels[0][1];
                    }

                    // If there are multiple labels, use the key=value format
                    return filteredLabels.map(([key, value]) => `${key}=${value}`).join(',');
                };

                // Find the time range from the data and collect unique label sets
                let minTime = Number.MAX_SAFE_INTEGER;
                let maxTime = Number.MIN_SAFE_INTEGER;
                const uniqueLabelSets = new Set<string>();

                for (const frame of data) {
                    // Extract time and value from labels in frame.fields[1].labels
                    if (!frame.fields[1] || !frame.fields[1].labels) {
                        continue;
                    }

                    const labels = frame.fields[1].labels;
                    console.log('Labels:', labels);

                    // Get time value from labels
                    const timeValueStr = labels[timeFieldName];
                    if (timeValueStr === undefined) {
                        continue;
                    }

                    // Convert string to number for time calculations
                    const timeValue = Number(timeValueStr);
                    if (isNaN(timeValue)) {
                        continue;
                    }

                    if (timeValue < minTime) {
                        minTime = timeValue;
                    }
                    if (timeValue > maxTime) {
                        maxTime = timeValue;
                    }

                    // Create label set key (excluding time field)
                    const labelSet = createLabelSetKey(labels);
                    uniqueLabelSets.add(labelSet);
                }

                // If no valid time range found, return original data
                if (minTime === Number.MAX_SAFE_INTEGER || maxTime === Number.MIN_SAFE_INTEGER) {
                    return [];
                }

                // Calculate bucket size based on time difference between consecutive samples
                let bucketSize = data?.[0]?.fields?.[0]?.config?.interval;
                if (!bucketSize || isNaN(bucketSize) || bucketSize <= 0) {
                    return []; // If bucket size is invalid, return original data
                }

                // Create output frame
                const outputFrame = new MutableDataFrame();

                // Add time field
                const timeField: Field = {
                    name: 'Time',
                    type: FieldType.time,
                    values: [],
                    config: {},
                };
                outputFrame.addField(timeField);

                // Add value fields for each unique label set
                const labelSetFields: Record<string, Field> = {};
                for (const labelSet of uniqueLabelSets) {
                    const fieldName = labelSet || 'Value';
                    const field: Field = {
                        name: fieldName,
                        type: FieldType.number,
                        values: [],
                        config: {},
                    };
                    labelSetFields[labelSet] = field;
                    outputFrame.addField(field);
                }

                // Collect data by rounded timestamp and label set
                const timeDataMap = new Map<number, Map<string, number>>();

                // Process each series
                for (const frame of data) {
                    if (!frame.fields[1] || !frame.fields[1].labels) {
                        continue; // Skip frames without labels
                    }

                    const labels = frame.fields[1].labels;

                    // Get time value from labels
                    const timeValueStr = labels[timeFieldName];
                    if (timeValueStr === undefined) {
                        continue; // Skip frames without the time field in labels
                    }

                    // Convert string to number for time calculations
                    const timeValue = Number(timeValueStr);
                    if (isNaN(timeValue)) {
                        continue;
                    }

                    // Get value from labels (look for a numeric field)
                    const value = frame.fields?.[1].values?.[0];

                    if (!value) {
                        continue; // Skip frames without a numeric value field
                    }

                    // Truncate time to bucket size
                    const truncatedTime = Math.floor(timeValue / bucketSize) * bucketSize;

                    // Create label set key (excluding time field)
                    const labelSet = createLabelSetKey(labels);

                    // Add to time data map, summing values for collisions
                    if (!timeDataMap.has(truncatedTime)) {
                        timeDataMap.set(truncatedTime, new Map());
                    }
                    const labelMap = timeDataMap.get(truncatedTime)!;
                    const currentValue = labelMap.get(labelSet) || 0;
                    labelMap.set(labelSet, currentValue + value);
                }

                // Convert map to sorted array and add to output frame
                const sortedTimes = Array.from(timeDataMap.keys()).sort((a, b) => a - b);

                for (const time of sortedTimes) {
                    const labelMap = timeDataMap.get(time)!;
                    const rowData: Record<string, any> = {
                        Time: time,
                    };

                    // Set values for each label set
                    for (const labelSet of uniqueLabelSets) {
                        const value = labelMap.get(labelSet) || 0;
                        rowData[labelSet || 'Value'] = value;
                    }

                    outputFrame.add(rowData);
                }

                return [sortDataFrame(outputFrame, 0, true)];
            })
        ),
};
