import { useMemo } from 'react';
import uPlot, { BBox } from 'uplot';

import { DataFrame, FieldType } from '@grafana/data';
import { maybeSortFrame } from '@grafana/data/internal';
import { TimeRange2 } from '@grafana/ui/internal';

interface Props {
  annotations: DataFrame[];
  clusteringMode: ClusteringMode | null;
  plotBox?: BBox;
  timeRange: TimeRange2;
}

export enum ClusteringMode {
  Hover = 'hover',
  Render = 'render',
}

export const useAnnotationClustering = ({ annotations, clusteringMode, plotBox, timeRange }: Props) => {
  const { outAnnos } = useMemo(() => {
    const clusteredAnnotations: DataFrame[] = [];

    // per-frame clustering
    if (clusteringMode === ClusteringMode.Render) {
      for (let frameIdx = 0; frameIdx < annotations.length; frameIdx++) {
        const frame = annotations[frameIdx];

        const timeVals: number[] = frame.fields.find((f) => f.name === 'time')?.values ?? [];
        const colorVals: string[] = frame.fields.find((f) => f.name === 'color')?.values ?? [];

        if (timeVals.length > 1 && plotBox) {
          let { clusterIdx, clusters } = buildAnnotationClusters(frame, timeVals, plotBox, timeRange);

          const timeEndFrame: DataFrame = {
            ...frame,
            fields: frame.fields
              .map((field) => ({
                ...field,
                // Copy values
                values: [...field.values],
              }))
              // add new number field containing the cluster locations
              .concat({
                type: FieldType.number,
                name: 'clusterIdx',
                values: clusterIdx,
                config: {},
              }),
          };

          const hasTimeEndField = timeEndFrame.fields.findIndex((field) => field.name === 'timeEnd') !== -1;

          if (!hasTimeEndField) {
            timeEndFrame.fields.push({
              type: FieldType.time,
              name: 'timeEnd',
              values: Array(timeEndFrame.fields[0].values.length).fill(null),
              config: {},
            });
          }

          // append cluster annotation regions to frame
          clusters.forEach((idxs, ci) => {
            // @todo more succinctly?
            timeEndFrame.fields.forEach((field) => {
              const vals = field.values;
              if (field.name === 'time') {
                // Push the first clustered annotation as the annotation region start time
                vals.push(timeVals[idxs[0]]);
              } else if (field.name === 'timeEnd') {
                // push the last clustered annotation as the annotation region end time
                let lastIdx = idxs.length - 1;
                vals.push(timeVals[idxs[lastIdx]]);
              } else if (field.name === 'isRegion') {
                // Clusters are regions
                vals.push(true);
              } else if (field.name === 'color') {
                // Use the color of the first annotation in the region
                vals.push(colorVals[idxs[0]]);
              } else if (field.name === 'title') {
                vals.push(null);
              } else if (field.name === 'text') {
                vals.push(null);
              } else if (field.name === 'clusterIdx') {
                vals.push(ci);
              } else {
                vals.push(null);
              }
            });
          });

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
  }, [annotations, clusteringMode, plotBox, timeRange]);

  return outAnnos;
};

const buildAnnotationClusters = (frame: DataFrame, timeVals: number[], plotBox: BBox, timeRange: TimeRange2) => {
  const isRegionVals: boolean[] =
    frame.fields.find((f) => f.name === 'isRegion')?.values ?? Array(timeVals.length).fill(false);
  const clusterIdx: Array<number | null> = Array(timeVals.length).fill(null);
  const clusters: number[][] = [];

  let thisCluster: number[] = [];
  let prevIdx = null;
  const mergeThreshold = calculateMergeThreshold(timeRange, plotBox);

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

// Recommended minimum spacing between interactive elements (a11y)
const MIN_ANNOTATION_SPACING = 24;

const calculateMergeThreshold = (timeRange: TimeRange2, plotBox: BBox) => {
  const pixelThreshold = MIN_ANNOTATION_SPACING * uPlot.pxRatio;
  const dt = timeRange.to - timeRange.from;
  const plotWidth = plotBox?.width;
  // If the plot width is undefined or zero, something is very wrong! Let's avoid clustering in this case.
  if (!plotWidth) {
    return 0;
  }

  const thresholdRatio = pixelThreshold / plotWidth;
  return thresholdRatio * dt;
};
