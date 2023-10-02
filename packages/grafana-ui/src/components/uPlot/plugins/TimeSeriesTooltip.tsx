import React from 'react';

import { DataFrame, FALLBACK_COLOR, FieldType, formattedValueToString } from '@grafana/data';

import { SeriesTable, SeriesTableRowProps } from '../../VizTooltip';

// exemplar / annotation / time region hovering?
// add annotation UI / alert dismiss UI?

interface TimeSeriesTooltipProps {
  // aligned series frame
  seriesFrame: DataFrame;

  // hovered points
  valueIdxs: Array<number | null>;

  // closest/hovered series
  seriesIdx?: number | null;

  isPinned: boolean;
}

export const TimeSeriesTooltip = ({ seriesFrame, valueIdxs, seriesIdx, isPinned = false }: TimeSeriesTooltipProps) => {
  const xField = seriesFrame.fields[0];

  // if (mode === TooltipDisplayMode.Multi)...

  const xVal = formattedValueToString(xField.display!(xField.values[valueIdxs[0]!]));

  let series: SeriesTableRowProps[] = [];
  const fields = seriesFrame.fields;
  //   const sortIdx: unknown[] = [];

  for (let i = 0; i < fields.length; i++) {
    const field = seriesFrame.fields[i];
    if (
      !field ||
      field === xField ||
      field.type === FieldType.time ||
      field.type !== FieldType.number ||
      field.config.custom?.hideFrom?.tooltip ||
      field.config.custom?.hideFrom?.viz
    ) {
      continue;
    }

    const v = seriesFrame.fields[i].values[valueIdxs[i]!];
    const display = field.display!(v); // super expensive :(

    // sortIdx.push(v);
    series.push({
      color: display.color || FALLBACK_COLOR,
      // label: getFieldDisplayName(field, frame, otherProps.frames), // use cached field.state.displayName
      label: field.state?.displayName ?? field.name,
      value: display ? formattedValueToString(display) : null,
      isActive: seriesIdx === i,
    });
  }

  /*
  if (sortOrder !== SortOrder.None) {
    // create sort reference series array, as Array.sort() mutates the original array
    const sortRef = [...series];
    const sortFn = arrayUtils.sortValues(sortOrder);

    series.sort((a, b) => {
      // get compared values indices to retrieve raw values from sortIdx
      const aIdx = sortRef.indexOf(a);
      const bIdx = sortRef.indexOf(b);
      return sortFn(sortIdx[aIdx], sortIdx[bIdx]);
    });
  }
  */

  return <SeriesTable series={series} timestamp={xVal} />;
};
