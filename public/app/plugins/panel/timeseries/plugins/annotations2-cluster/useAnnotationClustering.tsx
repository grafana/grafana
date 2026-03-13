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
}

export enum ClusteringMode {
  Hover = 'hover',
  Render = 'render',
}

export const useAnnotationClustering = ({ annotations, clusteringMode, plotWidth, timeRange }: Props) => {
  const { outAnnos } = useMemo(() => {
    const clusteredAnnotations: DataFrame[] = [];

    // per-frame clustering
    if (clusteringMode === ClusteringMode.Render) {
      for (let frameIdx = 0; frameIdx < annotations.length; frameIdx++) {
        const frame = annotations[frameIdx];

        const timeVals: number[] = frame.fields.find((f) => f.name === 'time')?.values ?? [];
        const colorVals: string[] = frame.fields.find((f) => f.name === 'color')?.values ?? [];

        if (timeVals.length > 1 && plotWidth) {
          let { clusterIdx, clusters } = buildAnnotationClusters(frame, timeVals, plotWidth, timeRange);

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
          const timeEndFrame: DataFrame = {
            ...frame,
            fields: clusteredFields,
          };

          const hasTimeEndField = timeEndFrame.fields.findIndex((field) => field.name === 'timeEnd') !== -1;

          // If the annotation frame doesn't already have an end field defined we'll need to add one so we can create valid annotation regions
          if (!hasTimeEndField) {
            timeEndFrame.fields.push({
              type: FieldType.time,
              name: 'timeEnd',
              values: Array(timeEndFrame.fields[0].values.length).fill(null),
              config: {},
            });
          }

          // append cluster annotation regions to frame
          for (let ci = 0; ci < clusters.length; ci++) {
            const idxs = clusters[ci];
            const valMapping: Record<string, () => number | boolean | string> = {
              // Push the first clustered annotation as the annotation region start time
              time: () => timeVals[idxs[0]],
              // push the last clustered annotation as the annotation region end time
              timeEnd: () => timeVals[idxs[idxs.length - 1]],
              // Clusters are regions
              isRegion: () => true,
              // Push color of the first annotation in the region
              color: () => colorVals[idxs[0]],
              // Push cluster index
              clusterIdx: () => ci,
            };
            for (const field of timeEndFrame.fields) {
              field.values.push(valMapping?.[field.name]?.() ?? null);
            }
          }
          // Set data frame length
          timeEndFrame.length = timeEndFrame.fields[0].values.length;
          clusteredAnnotations.push(timeEndFrame);
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

  return outAnnos;
};

const buildAnnotationClusters = (frame: DataFrame, timeVals: number[], plotWidth: number, timeRange: TimeRange2) => {
  const isRegionVals: boolean[] =
    frame.fields.find((f) => f.name === 'isRegion')?.values ?? Array(timeVals.length).fill(false);
  const clusterIdx: Array<number | null> = Array(timeVals.length).fill(null);
  const clusters: number[][] = [];

  let thisCluster: number[] = [];
  let prevIdx = null;
  const mergeThreshold = calculateMergeThreshold(timeRange, plotWidth);

  for (let j = 0; j < timeVals.length; j++) {
    let time = timeVals[j];

    // Don't cluster regions?
    if (!isRegionVals[j]) {
      if (prevIdx != null) {
        // if we're within the threshold
        if (time - timeVals[prevIdx] <= mergeThreshold) {
          // open cluster
          if (thisCluster.length === 0) {
            thisCluster.push(prevIdx);
            clusterIdx[prevIdx] = clusters.length;
          }
          thisCluster.push(j);
          clusterIdx[j] = clusters.length;
        } else {
          // close cluster
          if (thisCluster.length > 0) {
            clusters.push(thisCluster);
            thisCluster = [];
          }
        }
      }

      prevIdx = j;
    }
  }

  // close cluster
  if (thisCluster.length > 0) {
    clusters.push(thisCluster);
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
