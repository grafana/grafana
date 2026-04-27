import { useMemo } from 'react';
import tinycolor from 'tinycolor2';

import { arrayToDataFrame, type DataFrame } from '@grafana/data/dataframe';
import { maybeSortFrame } from '@grafana/data/internal';
import { DataTopic } from '@grafana/data/types';
import { type TimeRange2 } from '@grafana/ui/internal';
import { DEFAULT_ANNOTATION_COLOR } from '@grafana/ui/utils';

import { getXAnnotationFrames, getXYAnnotationFrames } from '../utils';

interface Props {
  annotations?: DataFrame[];
  newRange: TimeRange2 | null;
}

const DEFAULT_ANNOTATION_COLOR_HEX8 = tinycolor(DEFAULT_ANNOTATION_COLOR).toHex8String();

/**
 * edit mode wip frame
 * @param newRange
 */
const buildWipAnnoFrame = (newRange: TimeRange2) => {
  let isRegion = newRange.to > newRange.from;

  const wipAnnoFrame = arrayToDataFrame([
    {
      time: newRange.from,
      timeEnd: isRegion ? newRange.to : null,
      isRegion: isRegion,
      // #00d3ffff
      color: DEFAULT_ANNOTATION_COLOR_HEX8,
      tags: [],
    },
  ]);

  wipAnnoFrame.meta = {
    dataTopic: DataTopic.Annotations,
    custom: {
      isWip: true,
    },
  };
  return wipAnnoFrame;
};

export const useAnnotations = ({ annotations, newRange }: Props) => {
  return useMemo(() => {
    let sortedAnnotations = annotations?.map((frame) =>
      maybeSortFrame(
        frame,
        frame.fields.findIndex((field) => field.name === 'time')
      )
    );
    const xAnnos = getXAnnotationFrames(sortedAnnotations);
    const xyAnnos = getXYAnnotationFrames(annotations);

    if (newRange) {
      xAnnos.push(buildWipAnnoFrame(newRange));
    }

    return { xAnnos, xyAnnos };
  }, [annotations, newRange]);
};
