import React, { useContext } from 'react';
import { FlotDataPoint } from './GraphContextMenuCtrl';
import { ContextMenu, ContextMenuProps, SeriesIcon, ThemeContext } from '@grafana/ui';
import { DateTimeInput } from '@grafana/data';
import { css } from 'emotion';

type GraphContextMenuProps = ContextMenuProps & {
  getContextMenuSource: () => FlotDataPoint | null;
  formatSourceDate: (date: DateTimeInput, format?: string) => string;
};

export const GraphContextMenu: React.FC<GraphContextMenuProps> = ({
  getContextMenuSource,
  formatSourceDate,
  items,
  ...otherProps
}) => {
  const theme = useContext(ThemeContext);
  const source = getContextMenuSource();

  //  Do not render items that do not have label specified
  const itemsToRender = items
    ? items.map(group => ({
        ...group,
        items: group.items.filter(item => item.label),
      }))
    : [];

  const renderHeader = source
    ? () => {
        if (!source) {
          return null;
        }

        const timeFormat = source.series.hasMsResolution ? 'YYYY-MM-DD HH:mm:ss.SSS' : 'YYYY-MM-DD HH:mm:ss';

        return (
          <div
            className={css`
              padding: ${theme.spacing.xs} ${theme.spacing.sm};
              font-size: ${theme.typography.size.sm};
            `}
          >
            <strong>{formatSourceDate(source.datapoint[0], timeFormat)}</strong>
            <div>
              <SeriesIcon color={source.series.color} />
              <span
                className={css`
                  white-space: nowrap;
                  padding-left: ${theme.spacing.xs};
                `}
              >
                {source.series.alias}
              </span>
            </div>
          </div>
        );
      }
    : null;

  return <ContextMenu {...otherProps} items={itemsToRender} renderHeader={renderHeader} />;
};
