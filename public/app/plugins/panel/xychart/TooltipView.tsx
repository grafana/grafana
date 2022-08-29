import { css } from '@emotion/css';
import React from 'react';

import {
  arrayUtils,
  DataFrame,
  Field,
  formattedValueToString,
  getFieldDisplayName,
  GrafanaTheme2,
} from '@grafana/data';
import { SortOrder } from '@grafana/schema';
import { SeriesIcon, TooltipDisplayMode, useStyles2, VizTooltipOptions } from '@grafana/ui';

import { ScatterSeries } from './types';

export interface Props {
  allSeries: ScatterSeries[];
  data: DataFrame[]; // source data
  rowIndex?: number; // the hover row
  hoveredPointIndex: number; // the hovered point
  options: VizTooltipOptions;
}

export const TooltipView = ({ allSeries, data, rowIndex, hoveredPointIndex, options }: Props) => {
  const style = useStyles2(getStyles);

  if (!allSeries || rowIndex == null) {
    return null;
  }

  const series = allSeries[hoveredPointIndex];
  const frame = series.frame(data);
  const xField = series.x(frame);
  const yField = series.y(frame);

  let yValues = [];
  if (options.mode === TooltipDisplayMode.Single) {
    yValues = [
      {
        name: getFieldDisplayName(yField, frame),
        val: yField.values.get(rowIndex),
        field: yField,
        color: series.pointColor(frame),
      },
    ];
  } else {
    yValues = allSeries
      .map((series, i) => {
        const frame = series.frame(data);
        const seriesXField = series.x(frame);

        if (seriesXField.name !== xField.name) {
          return null;
        }

        const seriesYField = series.y(frame);

        return {
          name: getFieldDisplayName(seriesYField, frame),
          val: seriesYField.values.get(rowIndex),
          field: seriesYField,
          color: allSeries[i].pointColor(frame),
        };
      })
      .filter((v) => v != null);
  }

  let activePointIndex = -1;
  if (options.sort !== SortOrder.None) {
    const sortFn = arrayUtils.sortValues(options.sort);

    yValues.sort((a, b) => {
      return sortFn(a!.val, b!.val);
    });

    activePointIndex = yValues.findIndex((v) => v!.name === series.name);
  }

  return (
    <>
      <div className={style.xVal} aria-label="x-val">
        {fmt(frame.fields[0], xField.values.get(rowIndex))}
      </div>
      <table className={style.infoWrap}>
        <tbody>
          {yValues.map((el, index) => {
            let color = null;
            if (typeof el!.color === 'string') {
              color = el!.color;
            }

            return (
              <tr key={`${index}/${rowIndex}`} className={index === activePointIndex ? style.highlight : ''}>
                <th>
                  {color && <SeriesIcon color={color} className={style.icon} />}
                  {el!.name}:
                </th>
                <td>{fmt(el!.field, el!.val)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
};

function fmt(field: Field, val: number): string {
  if (field.display) {
    return formattedValueToString(field.display(val));
  }
  return `${val}`;
}

const getStyles = (theme: GrafanaTheme2) => ({
  infoWrap: css`
    padding: 8px;
    th {
      font-weight: ${theme.typography.fontWeightMedium};
      padding: ${theme.spacing(0.25, 2)};
    }
  `,
  highlight: css`
    background: ${theme.colors.action.hover};
  `,
  xVal: css`
    font-weight: ${theme.typography.fontWeightBold};
  `,
  icon: css`
    margin-right: ${theme.spacing(1)};
    vertical-align: middle;
  `,
});
