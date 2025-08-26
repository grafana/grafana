import { css } from '@emotion/css';

import { DataFrame, Field, formattedValueToString, getFieldDisplayName, GrafanaTheme2, LinkModel } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { TextLink, useStyles2 } from '@grafana/ui';
import { renderValue } from 'app/plugins/panel/geomap/utils/uiUtils';
import { getDataLinks } from 'app/plugins/panel/status-history/utils';

export interface Props {
  data?: DataFrame; // source data
  rowIndex?: number | null; // the hover row
  columnIndex?: number | null; // the hover column
  header?: string;
  padding?: number;
}

export interface DisplayValue {
  name: string;
  value: unknown;
  valueString: string;
}

export function getDisplayValuesAndLinks(data: DataFrame, rowIndex: number, columnIndex?: number) {
  const visibleFields = data.fields.filter(
    (f, i) => !Boolean(f.config.custom?.hideFrom?.tooltip) && (columnIndex == null || i === columnIndex)
  );

  if (visibleFields.length === 0) {
    return null;
  }

  const displayValues: DisplayValue[] = [];
  const links: Array<LinkModel<Field>> = [];

  for (const field of visibleFields) {
    const value = field.values[rowIndex];
    const fieldDisplay = field.display ? field.display(value) : { text: `${value}`, numeric: +value };

    links.push(...getDataLinks(field, rowIndex));

    displayValues.push({
      name: getFieldDisplayName(field, data),
      value,
      valueString: formattedValueToString(fieldDisplay),
    });
  }

  return { displayValues, links };
}

export const DataHoverView = ({ data, rowIndex, header, padding = 0 }: Props) => {
  const styles = useStyles2(getStyles, padding);

  if (!data || rowIndex == null) {
    return null;
  }

  const dispValuesAndLinks = getDisplayValuesAndLinks(data, rowIndex);

  if (dispValuesAndLinks == null) {
    return null;
  }

  const { displayValues, links } = dispValuesAndLinks;

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
