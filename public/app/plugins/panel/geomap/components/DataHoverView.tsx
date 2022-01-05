import React, { PureComponent } from 'react';
import { stylesFactory } from '@grafana/ui';
import {
  ArrayDataFrame,
  DataFrame,
  Field,
  formattedValueToString,
  getFieldDisplayName,
  GrafanaTheme2,
} from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import { FeatureLike } from 'ol/Feature';

export interface Props {
  data?: DataFrame; // source data
  feature?: FeatureLike;
  rowIndex?: number | null; // the hover row
  columnIndex?: number | null; // the hover column
}

export class DataHoverView extends PureComponent<Props> {
  style = getStyles(config.theme2);

  render() {
    const { feature, columnIndex } = this.props;
    let { data, rowIndex } = this.props;
    if (feature) {
      const { geometry, ...properties } = feature.getProperties();
      data = new ArrayDataFrame([properties]);
      rowIndex = 0;
    }

    if (!data || rowIndex == null) {
      return null;
    }

    return (
      <table className={this.style.infoWrap}>
        <tbody>
          {data.fields
            .filter((f) => !Boolean(f.config.custom?.hideFrom?.tooltip))
            .map((f, i) => (
              <tr key={`${i}/${rowIndex}`} className={i === columnIndex ? this.style.highlight : ''}>
                <th>{getFieldDisplayName(f, data)}:</th>
                <td>{fmt(f, rowIndex!)}</td>
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
