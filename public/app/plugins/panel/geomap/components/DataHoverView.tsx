import { css } from '@emotion/css';
import React from 'react';

import {
  arrayUtils,
  DataFrame,
  Field,
  formattedValueToString,
  getFieldDisplayName,
  GrafanaTheme2,
  LinkModel,
} from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema';
import { LinkButton, useStyles2, VerticalGroup } from '@grafana/ui';

export interface Props {
  data?: DataFrame; // source data
  rowIndex?: number | null; // the hover row
  columnIndex?: number | null; // the hover column
  sortOrder?: SortOrder;
  mode?: TooltipDisplayMode | null;
}

export const DataHoverView = ({ data, rowIndex, columnIndex, sortOrder, mode }: Props) => {
  const styles = useStyles2(getStyles);

  if (!data || rowIndex == null) {
    return null;
  }

  const visibleFields = data.fields.filter((f) => !Boolean(f.config.custom?.hideFrom?.tooltip));

  if (visibleFields.length === 0) {
    return null;
  }

  const displayValues: Array<[string, unknown, string]> = [];
  const links: Array<LinkModel<Field>> = [];
  const linkLookup = new Set<string>();

  for (const f of visibleFields) {
    const v = f.values.get(rowIndex);
    const disp = f.display ? f.display(v) : { text: `${v}`, numeric: +v };
    if (f.getLinks) {
      f.getLinks({ calculatedValue: disp, valueRowIndex: rowIndex }).forEach((link) => {
        const key = `${link.title}/${link.href}`;
        if (!linkLookup.has(key)) {
          links.push(link);
          linkLookup.add(key);
        }
      });
    }

    displayValues.push([getFieldDisplayName(f, data), v, formattedValueToString(disp)]);
  }

  if (sortOrder && sortOrder !== SortOrder.None) {
    displayValues.sort((a, b) => arrayUtils.sortValues(sortOrder)(a[1], b[1]));
  }

  return (
    <table className={styles.infoWrap}>
      <tbody>
        {(mode === TooltipDisplayMode.Multi || mode == null) &&
          displayValues.map((v, i) => (
            <tr key={`${i}/${rowIndex}`} className={i === columnIndex ? styles.highlight : ''}>
              <th>{v[0]}:</th>
              <td>{v[2]}</td>
            </tr>
          ))}
        {mode === TooltipDisplayMode.Single && columnIndex && (
          <tr key={`${columnIndex}/${rowIndex}`}>
            <th>{displayValues[columnIndex][0]}:</th>
            <td>{displayValues[columnIndex][2]}</td>
          </tr>
        )}
        {links.length > 0 && (
          <tr>
            <td colSpan={2}>
              <VerticalGroup>
                {links.map((link, i) => (
                  <LinkButton
                    key={i}
                    icon={'external-link-alt'}
                    target={link.target}
                    href={link.href}
                    onClick={link.onClick}
                    fill="text"
                    style={{ width: '100%' }}
                  >
                    {link.title}
                  </LinkButton>
                ))}
              </VerticalGroup>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

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
});
