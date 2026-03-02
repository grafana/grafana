import { useMemo } from 'react';
import tinycolor from 'tinycolor2';

import { arrayToDataFrame, DataFrame, DataTopic } from '@grafana/data';
import { maybeSortFrame } from '@grafana/data/internal';
import { DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';
import { TimeRange2 } from '@grafana/ui/internal';

import { getXAnnotationFrames } from '../utils';

interface Props {
  annotations: DataFrame[];
  newRange: TimeRange2 | null;
}

const DEFAULT_ANNOTATION_COLOR_HEX8 = tinycolor(DEFAULT_ANNOTATION_COLOR).toHex8String();

export const useAnnotations = ({ annotations, newRange }: Props) => {
  const _annos = useMemo(() => {
    let sortedAnnotations = annotations.map((frame) =>
      maybeSortFrame(
        frame,
        frame.fields.findIndex((field) => field.name === 'time')
      )
    );
    let annos = getXAnnotationFrames(sortedAnnotations);

    if (newRange) {
      let isRegion = newRange.to > newRange.from;

      const wipAnnoFrame = arrayToDataFrame([
        {
          time: newRange.from,
          timeEnd: isRegion ? newRange.to : null,
          isRegion: isRegion,
          color: DEFAULT_ANNOTATION_COLOR_HEX8,
        },
      ]);

      wipAnnoFrame.meta = {
        dataTopic: DataTopic.Annotations,
        custom: {
          isWip: true,
        },
      };

      annos.push(wipAnnoFrame);
    }

    return annos;
  }, [annotations, newRange]);

  return _annos;
};
