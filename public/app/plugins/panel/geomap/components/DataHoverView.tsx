import React, { PureComponent } from 'react';
import { stylesFactory } from '@grafana/ui';
import {
  arrayUtils,
  DataFrame,
  Field,
  formattedValueToString,
  getFieldDisplayName,
  GrafanaTheme2,
} from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import { SortOrder } from '@grafana/schema';
import { GeomapLayerHover } from '../event';

export interface Props {
  data?: DataFrame; // source data
  layers?: GeomapLayerHover[];
  rowIndex?: number | null; // the hover row
  columnIndex?: number | null; // the hover column
  sortOrder?: SortOrder;
}

export class DataHoverView extends PureComponent<Props> {
  style = getStyles(config.theme2);

  render() {
    const { layers, columnIndex, sortOrder } = this.props;
    if (layers) {
      console.log('hover', layers);
      return (
        <div>
          {layers.map((g) => (
            <div key={g.layer.getName()}>
              <b>{g.layer.getName()}</b>
              <div>
                {g.features.map((f, idx) => (
                  <div key={idx}>FEATURE: {`${f}`}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    let { data, rowIndex } = this.props;

    if (!data || rowIndex == null) {
      return null;
    }

    const displayValues: Array<[string, any, string]> = [];
    const visibleFields = data.fields.filter((f) => !Boolean(f.config.custom?.hideFrom?.tooltip));

    if (visibleFields.length === 0) {
      return null;
    }
    for (let i = 0; i < visibleFields.length; i++) {
      displayValues.push([
        getFieldDisplayName(visibleFields[i], data),
        visibleFields[i].values.get(rowIndex!),
        fmt(visibleFields[i], rowIndex),
      ]);
    }

    if (sortOrder && sortOrder !== SortOrder.None) {
      displayValues.sort((a, b) => arrayUtils.sortValues(sortOrder)(a[1], b[1]));
    }

    return (
      <table className={this.style.infoWrap}>
        <tbody>
          {displayValues.map((v, i) => (
            <tr key={`${i}/${rowIndex}`} className={i === columnIndex ? this.style.highlight : ''}>
              <th>{v[0]}:</th>
              <td>{v[2]}</td>
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
