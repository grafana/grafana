import { css } from '@emotion/css';
import React, { PureComponent } from 'react';

import {
  arrayUtils,
  DataFrame,
  Field,
  formattedValueToString,
  getFieldDisplayName,
  GrafanaTheme2,
} from '@grafana/data';
import { SortOrder } from '@grafana/schema';
import { SeriesIcon, stylesFactory, TooltipDisplayMode, VizTooltipOptions } from '@grafana/ui';
import { config } from 'app/core/config';

import { ScatterSeries } from './types';

export interface Props {
  allSeries: ScatterSeries[];
  data: DataFrame[]; // source data
  rowIndex?: number; // the hover row
  hoveredPointIndex: number; // the hovered point
  options: VizTooltipOptions;
}

export class TooltipView extends PureComponent<Props> {
  style = getStyles(config.theme2);

  render() {
    const { allSeries, data, rowIndex, hoveredPointIndex, options } = this.props;
    if (!allSeries || rowIndex == null) {
      return null;
    }

    const series = allSeries[hoveredPointIndex];
    const frame = series.frame(data);
    const xValue = frame.fields[0].values.get(rowIndex);

    let yValues = [];
    if (options.mode === TooltipDisplayMode.Single) {
      yValues = [
        {
          name: getFieldDisplayName(frame.fields[hoveredPointIndex + 1], frame),
          val: frame.fields[hoveredPointIndex + 1].values.get(rowIndex),
          field: frame.fields[hoveredPointIndex + 1],
          color: series.pointColor(frame),
        },
      ];
    } else {
      yValues = frame.fields.map((f, i) => {
        if (i === 0) {
          return;
        }

        return {
          name: getFieldDisplayName(f, frame),
          val: f.values.get(rowIndex),
          field: f,
          color: allSeries[i - 1].pointColor(frame),
        };
      });

      yValues.shift();
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
        <div className={this.style.xVal} aria-label="x-val">
          {fmt(frame.fields[0], xValue)}
        </div>
        <table className={this.style.infoWrap}>
          <tbody>
            {yValues.map((el, index) => {
              let color = null;
              if (typeof el!.color === 'string') {
                color = el!.color;
              }

              return (
                <tr key={`${index}/${rowIndex}`} className={index === activePointIndex ? this.style.highlight : ''}>
                  <th>
                    {color && <SeriesIcon color={color} className={this.style.icon} />}
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
  }
}

function fmt(field: Field, val: number): string {
  if (field.display) {
    return formattedValueToString(field.display(val));
  }
  return `${val}`;
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
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
}));
