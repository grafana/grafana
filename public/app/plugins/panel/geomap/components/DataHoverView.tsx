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
import { HorizontalGroup, LinkButton, useStyles2 } from '@grafana/ui';

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
  const links: Record<string, Array<LinkModel<Field>>> = {};

  for (const f of visibleFields) {
    const v = f.values.get(rowIndex);
    const disp = f.display ? f.display(v) : { text: `${v}`, numeric: +v };
    if (f.getLinks) {
      f.getLinks({ calculatedValue: disp, valueRowIndex: rowIndex }).forEach((link) => {
        const key = getFieldDisplayName(f, data);
        if (!links[key]) {
          links[key] = [];
        }
        links[key].push(link);
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
              <td>{renderWithLinks(v[0], v[2], links)}</td>
            </tr>
          ))}
        {mode === TooltipDisplayMode.Single && columnIndex && (
          <tr key={`${columnIndex}/${rowIndex}`}>
            <th>{displayValues[columnIndex][0]}:</th>
            <td>{renderWithLinks(displayValues[columnIndex][0], displayValues[columnIndex][2], links)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

const renderWithLinks = (key: string, val: string, links: Record<string, Array<LinkModel<Field>>>) =>
  links[key] ? (
    <HorizontalGroup>
      <>
        {val}
        {links[key].map((link, i) => (
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
      </>
    </HorizontalGroup>
  ) : (
    <>{val}</>
  );

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
