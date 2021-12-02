import React, { PureComponent } from 'react';
import { stylesFactory } from '@grafana/ui';
import { DataFrame, Field, formattedValueToString, getFieldDisplayName, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import { FeatureLike } from 'ol/Feature';

export interface Props {
  data?: DataFrame; // source data
  feature?: FeatureLike;
  rowIndex?: number; // the hover row
  columnIndex?: number; // the hover column
}

export class DataHoverView extends PureComponent<Props> {
  style = getStyles(config.theme2);

  render() {
    const { data, feature, rowIndex, columnIndex } = this.props;
    const excludeFields = ['geometry']; //TODO: add custom fields
    const details = getDetails({ data, feature, rowIndex, columnIndex, excludeFields });
    return (
      <table className={this.style.infoWrap}>
        <tbody>
          {details &&
            details.map((d, i) => {
              return (
                <tr key={`${i}-${d}`} className={i === columnIndex ? this.style.highlight : ''}>
                  <th>{`${d.header}`}</th>
                  <td>{`${d.data}`}</td>
                </tr>
              );
            })}
        </tbody>
      </table>
    );
  }
}

const getDetails = (
  props: Partial<Props> & { excludeFields: string[] }
): Array<{ header: string; data: string }> | null => {
  const { data, feature, rowIndex, excludeFields } = props;
  if (feature) {
    const features = feature.get('features');
    if (features) {
      if (features.length > 1) {
        return [{ header: 'Clustered:', data: features.length }];
      } else {
        const soloFeat = features[0].getProperties();
        if (soloFeat?.frame) {
          return fmtFrame(soloFeat.frame, soloFeat.rowIndex, excludeFields);
        }
        return null;
      }
    } else {
      return Object.entries(feature.getProperties())
        .filter((f) => !excludeFields.includes(f[0]))
        .map((e, i) => ({ header: `${e[0]}:`, data: `${e[1]}` }));
    }
  } else {
    if (!data || rowIndex == null) {
      return null;
    }
    return fmtFrame(data, rowIndex, excludeFields);
  }
};

function fmtFrame(
  frame: DataFrame,
  rowIndex: number,
  excludeFields: string[]
): Array<{ header: string; data: string }> {
  return frame.fields
    .filter((f) => {
      return !excludeFields.includes(getFieldDisplayName(f, frame));
    })
    .map((f: Field, i: number) => ({
      header: `${getFieldDisplayName(f, frame)}:`,
      data: `${fmtField(f, rowIndex)}`,
    }));
}

function fmtField(field: Field, row: number): string {
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
