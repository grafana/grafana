import React, { PureComponent } from 'react';
import { stylesFactory } from '@grafana/ui';
import { DataFrame, Field, formattedValueToString, getFieldDisplayName, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import { ScatterSeries } from './types';

export interface Props {
  series: ScatterSeries;
  data: DataFrame[]; // source data
  rowIndex?: number; // the hover row
}

export class TooltipView extends PureComponent<Props> {
  style = getStyles(config.theme2);

  render() {
    const { series, data, rowIndex } = this.props;
    if (!series || rowIndex == null) {
      return null;
    }
    const frame = series.frame(data);
    const y = undefined; // series.y(frame);

    return (
      <table className={this.style.infoWrap}>
        <tbody>
          {frame.fields.map((f, i) => (
            <tr key={`${i}/${rowIndex}`} className={f === y ? this.style.highlight : ''}>
              <th>{getFieldDisplayName(f, frame)}:</th>
              <td>{fmt(f, rowIndex)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
}

function fmt(field: Field, row: number): string {
  const v = field.values.get(row);
  if (field.display) {
    return formattedValueToString(field.display(v));
  }
  return `${v}`;
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
}));
