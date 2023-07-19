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
import { renderValue } from 'app/plugins/panel/geomap/utils/uiUtils';

export interface Props {
  data?: DataFrame; // source data
  rowIndex?: number | null; // the hover row
  columnIndex?: number | null; // the hover column
  sortOrder?: SortOrder;
  mode?: TooltipDisplayMode | null;
  header?: string;
}

interface DisplayValue {
  name: string;
  value: unknown;
  valueString: string;
  highlight: boolean;
}

export const DataHoverView = ({ data, rowIndex, columnIndex, sortOrder, mode, header = undefined }: Props) => {
  const styles = useStyles2(getStyles);

  if (!data || rowIndex == null) {
    return null;
  }
  const fields = data.fields.map((f, idx) => {
    return { ...f, hovered: idx === columnIndex };
  });
  const visibleFields = fields.filter((f) => !Boolean(f.config.custom?.hideFrom?.tooltip));
  const traceIDField = visibleFields.find((field) => field.name === 'traceID') || fields[0];
  const orderedVisibleFields = [];
  // Only include traceID if it's visible and put it in front.
  if (visibleFields.filter((field) => traceIDField === field).length > 0) {
    orderedVisibleFields.push(traceIDField);
  }
  orderedVisibleFields.push(...visibleFields.filter((field) => traceIDField !== field));

  if (orderedVisibleFields.length === 0) {
    return null;
  }

  const displayValues: DisplayValue[] = [];
  const links: Array<LinkModel<Field>> = [];
  const linkLookup = new Set<string>();

  for (const field of orderedVisibleFields) {
    if (mode === TooltipDisplayMode.Single && columnIndex != null && !field.hovered) {
      continue;
    }
    const value = field.values[rowIndex];
    const fieldDisplay = field.display ? field.display(value) : { text: `${value}`, numeric: +value };
    if (field.getLinks) {
      field.getLinks({ calculatedValue: fieldDisplay, valueRowIndex: rowIndex }).forEach((link) => {
        const key = `${link.title}/${link.href}`;
        if (!linkLookup.has(key)) {
          links.push(link);
          linkLookup.add(key);
        }
      });
    }

    displayValues.push({
      name: getFieldDisplayName(field, data),
      value,
      valueString: formattedValueToString(fieldDisplay),
      highlight: field.hovered,
    });
  }

  if (sortOrder && sortOrder !== SortOrder.None) {
    displayValues.sort((a, b) => arrayUtils.sortValues(sortOrder)(a.value, b.value));
  }

  const renderLinks = () =>
    links.length > 0 && (
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
    );

  return (
    <div className={styles.wrapper}>
      {header && (
        <div className={styles.header}>
          <span className={styles.title}>{header}</span>
        </div>
      )}
      <table className={styles.infoWrap}>
        <tbody>
          {displayValues.map((displayValue, i) => (
            <tr key={`${i}/${rowIndex}`} className={displayValue.highlight ? styles.highlight : ''}>
              <th>{displayValue.name}:</th>
              <td>{renderValue(displayValue.valueString)}</td>
            </tr>
          ))}
          {renderLinks()}
        </tbody>
      </table>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const bg = theme.isDark ? theme.v1.palette.dark2 : theme.v1.palette.white;
  const headerBg = theme.isDark ? theme.v1.palette.dark9 : theme.v1.palette.gray5;
  const tableBgOdd = theme.isDark ? theme.v1.palette.dark3 : theme.v1.palette.gray6;

  return {
    wrapper: css`
      background: ${bg};
      border: 1px solid ${headerBg};
      border-radius: ${theme.shape.borderRadius(2)};
    `,
    header: css`
      background: ${headerBg};
      padding: 6px 10px;
      display: flex;
    `,
    title: css`
      font-weight: ${theme.typography.fontWeightMedium};
      padding-right: ${theme.spacing(2)};
      overflow: hidden;
      display: inline-block;
      white-space: nowrap;
      text-overflow: ellipsis;
      flex-grow: 1;
    `,
    infoWrap: css`
      padding: 8px;
      th {
        font-weight: ${theme.typography.fontWeightMedium};
        padding: ${theme.spacing(0.25, 2)};
      }
      tr {
        background-color: ${theme.colors.background.primary};
        &:nth-child(even) {
          background-color: ${tableBgOdd};
        }
      }
    `,
    highlight: css`
      /* !important is required to overwrite default table styles */
      background: ${theme.colors.action.hover} !important;
    `,
    link: css`
      color: #6e9fff;
    `,
  };
};
