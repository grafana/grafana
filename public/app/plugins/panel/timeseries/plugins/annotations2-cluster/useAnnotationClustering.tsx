import { useMemo } from 'react';
import uPlot from 'uplot';

import { DataFrame, FieldType } from '@grafana/data';
import { maybeSortFrame } from '@grafana/data/internal';
import { TimeRange2 } from '@grafana/ui/internal';

import { DEFAULT_CLUSTERING_ANNOTATION_SPACING } from './constants';

interface Props {
  annotations: DataFrame[];
  clusteringMode: ClusteringMode | null;
  timeRange: TimeRange2;
  plotWidth: number | undefined;
  // When
  onAnnotationMutate: () => void;
}

export enum ClusteringMode {
  Hover = 'hover',
  Render = 'render',
}

export const useAnnotationClustering = ({
  annotations,
  clusteringMode,
  plotWidth,
  timeRange,
  onAnnotationMutate,
}: Props) => {
  const { outAnnos } = useMemo(() => {
    const clusteredAnnotations: DataFrame[] = [];

    // per-frame clustering
    if (clusteringMode === ClusteringMode.Render) {
      for (let frameIdx = 0; frameIdx < annotations.length; frameIdx++) {
        const frame = annotations[frameIdx];

        const timeVals: number[] = frame.fields.find((f) => f.name === 'time')?.values ?? [];
        const timeEndVals: Array<number | null> = frame.fields.find((f) => f.name === 'timeEnd')?.values ?? [];
        const colorVals: string[] = frame.fields.find((f) => f.name === 'color')?.values ?? [];

        if (timeVals.length > 1 && plotWidth) {
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

          const timeEndFieldIdx = frameWithCluster.fields.findIndex((field) => field.name === 'timeEnd');
          const hasTimeEndField = timeEndFieldIdx !== -1;

          // If the annotation frame doesn't already have an end field defined we'll need to add one so we can create valid annotation regions
          if (!hasTimeEndField) {
            frameWithCluster.fields.push({
              type: FieldType.time,
              name: 'timeEnd',
              values: Array(frameWithCluster.fields[0].values.length).fill(null),
              config: {},
            });
          }

          frameWithCluster.fields.push({
            type: FieldType.boolean,
            name: 'isCluster',
            values: Array(frameWithCluster.fields[0].values.length).fill(false),
            config: {},
          });

          console.log('timeEndFrame', { frameWithCluster, frame, timeEndVals, timeVals, pointClusters: clusters });

          // append cluster annotation regions to frame
          for (let ci = 0; ci < clusters.length; ci++) {
            const idxs = clusters[ci];
            const valMapping: Record<string, () => number | boolean | string> = {
              // Push the first clustered annotation as the annotation region start time
              time: () => timeVals[idxs[0]],
              // push the last clustered annotation as the annotation region end time
              // @todo not correct
              timeEnd: () => timeVals[idxs[idxs.length - 1]],
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

    if (clusteredAnnotations.length > 0) {
      onAnnotationMutate();
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
  }, [annotations, clusteringMode, onAnnotationMutate, plotWidth, timeRange]);

  return outAnnos;
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
  //
  // // point annotation clusters
  for (let j = 0; j < timeVals.length; j++) {
    const startTime = timeVals[j];
    const prevStartTime = prevIdx != null ? timeVals?.[prevIdx] : null;
    const prevEndTime = prevIdx != null ? timeEndVals[prevIdx] : null;

    const pushCluster = (prevIdx: number) => {
      // open cluster
      if (cluster.length === 0) {
        cluster.push(prevIdx);
        clusterIdx[prevIdx] = clusters.length;
      }
      cluster.push(j);
      clusterIdx[j] = clusters.length;
    };

    if (!isRegionVals[j]) {
      if (prevStartTime != null && prevIdx != null) {
        // if we're within the threshold
        // @todo need case for previous endTime
        if (startTime - prevStartTime <= mergeThreshold) {
          pushCluster(prevIdx);
        } else if (prevEndTime != null && startTime - prevEndTime <= mergeThreshold) {
          pushCluster(prevIdx);
        } else {
          // close cluster
          if (cluster.length > 0) {
            clusters.push(cluster);
            cluster = [];
          }
        }
      }
    } else {
      const endTime = timeEndVals[j];

      // this region anno, previous any anno
      if (prevStartTime != null && prevIdx != null && endTime != null) {
        // @todo missing internal case and simplify
        // If region start is within threshold of previous start
        if (startTime - prevStartTime <= mergeThreshold) {
          pushCluster(prevIdx);
        }
        // if region end is within threshold of previous start?
        else if (endTime - prevStartTime <= mergeThreshold) {
          pushCluster(prevIdx);
        }
        // if prev region end time within threshold of current start
        else if (prevEndTime != null && startTime - prevEndTime <= mergeThreshold) {
          pushCluster(prevIdx);
        }
        // if prev region end within threshold of current end
        else if (prevEndTime != null && endTime - prevEndTime <= mergeThreshold) {
          pushCluster(prevIdx);
        } else if (cluster.length > 0) {
          clusters.push(cluster);
          cluster = [];
        } else {
          // @todo remove debug
          console.log('Unexpected', { startTime, endTime, prevStartTime, prevEndTime });
        }
      }
    }

    prevIdx = j;
  }

  // close cluster
  if (cluster.length > 0) {
    clusters.push(cluster);
  }

  const regionClusterIdx: Array<number | null> = Array(timeVals.length).fill(null);
  prevIdx = null;
  return { clusterIdx: clusterIdx, clusters: clusters, regionClusterIdx };
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
