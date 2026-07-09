import { useMemo } from 'react';
import uPlot from 'uplot';

import { type DataFrame, FieldType } from '@grafana/data';
import { maybeSortFrame } from '@grafana/data/internal';
import { type TimeRange2 } from '@grafana/ui/internal';

import { DEFAULT_CLUSTERING_ANNOTATION_SPACING } from './constants';

interface Props {
  annotations: DataFrame[];
  clusteringMode: ClusteringMode | null;
  timeRange: TimeRange2;
  plotWidth: number | undefined;
}

export enum ClusteringMode {
  Hover = 'hover',
  Render = 'render',
}

export const useAnnotationClustering = ({ annotations, clusteringMode, plotWidth, timeRange }: Props) => {
  const { outAnnos } = useMemo(() => {
    const clusteredAnnotations: DataFrame[] = [];

    // don't return annotations until the plot is ready
    if (!plotWidth) {
      return { outAnnos: [] };
    }

    if (clusteringMode === ClusteringMode.Render) {
      // per-frame clustering
      for (let frameIdx = 0; frameIdx < annotations.length; frameIdx++) {
        const frame = annotations[frameIdx];

        const timeVals: number[] = frame.fields.find((f) => f.name === 'time')?.values ?? [];
        const timeEndVals: Array<number | null> = frame.fields.find((f) => f.name === 'timeEnd')?.values ?? [];
        const colorVals: string[] = frame.fields.find((f) => f.name === 'color')?.values ?? [];

        if (timeVals.length > 1) {
          const { clusterIdx, clusters } = buildAnnotationClusters(frame, timeVals, timeEndVals, plotWidth, timeRange);

          // Shallow copy fields and values and append the clusterIdx field
          const clusteredFields = frame.fields.map((field) => ({
            ...field,
            // Copy values
            values: [...field.values],
          }));
          clusteredFields.push({
            type: FieldType.number,
            name: 'clusterIdx',
            values: clusterIdx,
            config: {},
          });
          const frameWithCluster: DataFrame = {
            ...frame,
            fields: clusteredFields,
          };

          const hasTimeEndField = frameWithCluster.fields.findIndex((field) => field.name === 'timeEnd') !== -1;

          // If the annotation frame doesn't already have an end field defined we'll need to add one so we can create valid annotation regions
          if (!hasTimeEndField) {
            frameWithCluster.fields.push({
              type: FieldType.time,
              name: 'timeEnd',
              values: Array(frameWithCluster.fields[0].values.length).fill(null),
              config: {},
            });
          }

          // add new isCluster field to annotation frame so we can determine which annotations are clustered
          frameWithCluster.fields.push({
            type: FieldType.boolean,
            name: 'isCluster',
            values: Array(frameWithCluster.fields[0].values.length).fill(false),
            config: {},
          });

          // append cluster annotation regions to frame
          for (let ci = 0; ci < clusters.length; ci++) {
            const idxs = clusters[ci];
            let maxTimeEnd = -1;

            // If region annotations are in the cluster we need to check if the end time is later then
            for (let i = 0; i < idxs.length; i++) {
              const timeEnd = timeEndVals[idxs[i]];
              if (timeEnd && timeEnd > maxTimeEnd) {
                maxTimeEnd = timeEnd;
              }
            }

            const lastTimeVal = timeVals[idxs[idxs.length - 1]];

            // Annos are sorted by start time
            const valMapping: Record<string, () => number | boolean | string> = {
              // Push the first clustered annotation
              time: () => timeVals[idxs[0]],
              // push the max annotation end time
              timeEnd: () => Math.max(maxTimeEnd, lastTimeVal),
              // Clusters are regions
              isRegion: () => true,
              // Push color of the first annotation in the region
              color: () => colorVals[idxs[0]],
              // Push cluster index
              clusterIdx: () => ci,
              // identify as cluster
              isCluster: () => true,
            };
            for (const field of frameWithCluster.fields) {
              field.values.push(valMapping?.[field.name]?.() ?? null);
            }
          }
          // Set data frame length
          frameWithCluster.length = frameWithCluster.fields[0].values.length;
          clusteredAnnotations.push(frameWithCluster);
        } else {
          clusteredAnnotations.push(frame);
        }
      }
    } else if (clusteringMode === ClusteringMode.Hover) {
      // Have the tooltip be clustered, but not the annotations: https://github.com/grafana/grafana/issues/119436
      console.warn('Hover mode not implemented');
    }

    // Sort clustered frames
    return {
      outAnnos:
        clusteredAnnotations.length > 0
          ? clusteredAnnotations.map((frame) =>
              maybeSortFrame(
                frame,
                frame.fields.findIndex((field) => field.name === 'time')
              )
            )
          : annotations,
    };
  }, [annotations, clusteringMode, plotWidth, timeRange]);

  return { annotations: outAnnos };
};

const buildAnnotationClusters = (
  frame: DataFrame,
  timeVals: number[],
  timeEndVals: Array<number | null>,
  plotWidth: number,
  timeRange: TimeRange2
) => {
  const isRegionVals: boolean[] =
    frame.fields.find((f) => f.name === 'isRegion')?.values ?? Array(timeVals.length).fill(false);
  const clusterIdx: Array<number | null> = Array(timeVals.length).fill(null);
  const clusters: number[][] = [];

  let cluster: number[] = [];
  let prevIdx: null | number = null;
  const mergeThreshold = calculateMergeThreshold(timeRange, plotWidth);

  let clusterEndTime = -1;
  let clusterStartTime = Infinity;

  for (let j = 0; j < timeVals.length; j++) {
    const startTime = timeVals[j];
    const prevStartTime = prevIdx != null ? timeVals?.[prevIdx] : null;
    const prevEndTime = prevIdx != null ? timeEndVals[prevIdx] : null;

    if (prevEndTime && prevEndTime > clusterEndTime) {
      clusterEndTime = prevEndTime;
    }
    if (prevStartTime && prevStartTime < clusterStartTime) {
      clusterStartTime = prevStartTime;
    }

    const pushCluster = (prevIdx: number) => {
      // add previous anno if cluster is empty
      if (cluster.length === 0) {
        cluster.push(prevIdx);
        clusterIdx[prevIdx] = clusters.length;
      }

      // Add this anno to cluster
      cluster.push(j);
      clusterIdx[j] = clusters.length;
    };

    const closeCluster = () => {
      clusters.push(cluster);
      cluster = [];
      clusterEndTime = -1;
      clusterStartTime = Infinity;
    };

    const startTimeWithinThreshold = prevStartTime && startTime - prevStartTime <= mergeThreshold;
    const startTimeWithinClusterThreshold = startTime - clusterStartTime <= mergeThreshold;
    const endTimeWithinClusterThreshold = startTime - clusterEndTime <= mergeThreshold;
    const regionsOverlap = clusterEndTime > startTime - mergeThreshold;

    if (prevIdx != null) {
      // Point annotation clusters
      if (!isRegionVals[j]) {
        if (startTimeWithinClusterThreshold || endTimeWithinClusterThreshold || startTimeWithinThreshold) {
          pushCluster(prevIdx);
        } else if (cluster.length > 0) {
          closeCluster();
        }
      }
      // region annotation clusters
      else {
        if (
          regionsOverlap ||
          startTimeWithinClusterThreshold ||
          endTimeWithinClusterThreshold ||
          startTimeWithinThreshold
        ) {
          pushCluster(prevIdx);
        } else if (cluster.length > 0) {
          closeCluster();
        }
      }
    }

    prevIdx = j;
  }

  // close cluster
  if (cluster.length > 0) {
    clusters.push(cluster);
  }

  return { clusterIdx, clusters };
};

const calculateMergeThreshold = (timeRange: TimeRange2, plotWidth: number) => {
  // If the plot width is zero, something is very wrong! Let's avoid clustering in this case.
  if (!plotWidth || plotWidth < 0 || isNaN(plotWidth)) {
    return -1;
  }

  const pixelThreshold = DEFAULT_CLUSTERING_ANNOTATION_SPACING * uPlot.pxRatio;
  const dt = timeRange.to - timeRange.from;
  const thresholdRatio = pixelThreshold / plotWidth;
  return thresholdRatio * dt;
};
