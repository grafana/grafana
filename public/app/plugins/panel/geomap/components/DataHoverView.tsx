import React, { PureComponent } from 'react';
import { stylesFactory } from '@grafana/ui';
import { DataFrame, Field, formattedValueToString, getFieldDisplayName, GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';

export interface Props {
  data?: DataFrame; // source data
  rowIndex?: number; // the hover row
  columnIndex?: number; // the hover column
}

export class DataHoverView extends PureComponent<Props> {
  style = getStyles(config.theme);

  render() {
    const { data, rowIndex } = this.props;
    if (!data || rowIndex == null) {
      return null;
    }

    return (
      <table className={this.style.infoWrap}>
        <tbody>
          {data.fields.map((f, i) => (
            <tr key={`${i}/${rowIndex}`}>
              <th>{getFieldDisplayName(f, data)}:</th>
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

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  infoWrap: css`
    padding: 8px;
    th {
      font-weight: bold;
      padding: 2px 10px 2px 0px;
    }
  `,
}));
