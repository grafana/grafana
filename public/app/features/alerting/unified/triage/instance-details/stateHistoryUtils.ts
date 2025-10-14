import { AnnotationEvent, DataFrame, DataTopic, arrayToDataFrame } from '@grafana/data';

import { LogRecord } from '../../components/rules/state-history/common';

// Function to get color based on alert state - matching EventState component colors
function getStateColor(state: string): string {
  const stateStr = String(state).toLowerCase();
  if (stateStr.includes('normal')) {
    return '#73BF69'; // Green
  } else if (stateStr.includes('alerting')) {
    return '#F2495C'; // Red
  } else if (stateStr.includes('pending')) {
    return '#FF9830'; // Orange
  } else if (stateStr.includes('recovering')) {
    return '#FF9830'; // Orange
  } else if (stateStr.includes('nodata')) {
    return '#5794F2'; // Blue
  }
  return '#8e8e8e'; // Gray for unknown states
}

/**
 * Converts log records to annotation DataFrames
 * @param logRecords Array of LogRecord objects
 * @returns Array of annotation DataFrames (empty array if no data)
 */
export function convertStateHistoryToAnnotations(logRecords: LogRecord[]): DataFrame[] {
  if (!logRecords || logRecords.length === 0) {
    return [];
  }

  const annotationEvents: AnnotationEvent[] = logRecords.map((record) => {
    const { timestamp, line } = record;
    return {
      time: timestamp,
      title: `${line.previous} → ${line.current}`,
      text: `State changed from ${line.previous} to ${line.current}`,
      tags: ['state-transition'],
      color: getStateColor(line.current),
    };
  });

  if (annotationEvents.length === 0) {
    return [];
  }

  const annotationFrame = arrayToDataFrame(annotationEvents);
  annotationFrame.meta = { dataTopic: DataTopic.Annotations };
  return [annotationFrame];
}
