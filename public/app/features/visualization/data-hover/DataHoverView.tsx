import { css } from '@emotion/css';

import {
  arrayUtils,
  DataFrame,
  Field,
  formattedValueToString,
  getFieldDisplayName,
  GrafanaTheme2,
  LinkModel,
} from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema';
import { TextLink, useStyles2 } from '@grafana/ui';
import { renderValue } from 'app/plugins/panel/geomap/utils/uiUtils';

import { ExemplarTooltip } from './ExemplarTooltip';

export interface Props {
  data?: DataFrame; // source data
  rowIndex?: number | null; // the hover row
  columnIndex?: number | null; // the hover column
  sortOrder?: SortOrder;
  mode?: TooltipDisplayMode | null;
  header?: string;
  padding?: number;
  maxHeight?: number;
}

export interface DisplayValue {
  name: string;
  value: unknown;
  valueString: string;
  highlight: boolean;
}

export function getDisplayValuesAndLinks(
  data: DataFrame,
  rowIndex: number,
  columnIndex?: number | null,
  sortOrder?: SortOrder,
  mode?: TooltipDisplayMode | null
) {
  const fields = data.fields;
  const hoveredField = columnIndex != null ? fields[columnIndex] : null;

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
    if (mode === TooltipDisplayMode.Single && field !== hoveredField) {
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
      highlight: field === hoveredField,
    });
  }

  if (sortOrder && sortOrder !== SortOrder.None) {
    displayValues.sort((a, b) => arrayUtils.sortValues(sortOrder)(a.value, b.value));
  }

  return { displayValues, links };
}

export const DataHoverView = ({
  data,
  rowIndex,
  columnIndex,
  sortOrder,
  mode,
  header,
  padding = 0,
  maxHeight,
}: Props) => {
  const styles = useStyles2(getStyles, padding);

  if (!data || rowIndex == null) {
    return null;
  }

  const dispValuesAndLinks = getDisplayValuesAndLinks(data, rowIndex, columnIndex, sortOrder, mode);

  if (dispValuesAndLinks == null) {
    return null;
  }

  const { displayValues, links } = dispValuesAndLinks;

  if (header === 'Exemplar') {
    return (
      <ExemplarTooltip
        displayValues={displayValues}
        links={links}
        headerLabel={header}
        maxHeight={maxHeight}
        isPinned={false}
      />
    );
  }

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
            <tr key={`${i}/${rowIndex}`}>
              <th>{displayValue.name}</th>
              <td>{renderValue(displayValue.valueString)}</td>
            </tr>
          ))}
          {links.map((link, i) => (
            <tr key={i}>
              <th>
                <Trans i18nKey="visualization.data-hover-view.link">Link</Trans>
              </th>
              <td colSpan={2}>
                <TextLink href={link.href} external={link.target === '_blank'} weight={'medium'} inline={false}>
                  {link.title}
                </TextLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
const getStyles = (theme: GrafanaTheme2, padding = 0) => {
  return {
    wrapper: css({
      padding: `${padding}px`,
      background: theme.components.tooltip.background,
      borderRadius: theme.shape.borderRadius(2),
    }),
    header: css({
      background: theme.colors.background.secondary,
      alignItems: 'center',
      alignContent: 'center',
      display: 'flex',
      paddingBottom: theme.spacing(1),
    }),
    title: css({
      fontWeight: theme.typography.fontWeightMedium,
      overflow: 'hidden',
      display: 'inline-block',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      flexGrow: 1,
    }),
    infoWrap: css({
      padding: theme.spacing(1),
      background: 'transparent',
      border: 'none',
      th: {
        fontWeight: theme.typography.fontWeightMedium,
        padding: theme.spacing(0.25, 2, 0.25, 0),
      },

      tr: {
        borderBottom: `1px solid ${theme.colors.border.weak}`,
        '&:last-child': {
          borderBottom: 'none',
        },
      },
    }),
    link: css({
      color: theme.colors.text.link,
    }),
  };
};
