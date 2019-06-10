import React, { useContext } from 'react';
import { FlotDataPoint } from './GraphContextMenuCtrl';
import { ContextMenu, ContextMenuProps, dateTime, SeriesIcon, ThemeContext } from '@grafana/ui';
import { css } from 'emotion';

type GraphContextMenuProps = ContextMenuProps & {
  getContextMenuSource: () => FlotDataPoint | null;
};

export const GraphContextMenu: React.FC<GraphContextMenuProps> = ({ getContextMenuSource, ...otherProps }) => {
  const theme = useContext(ThemeContext);
  const source = getContextMenuSource();

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
            <strong>{dateTime(source.datapoint[0]).format(timeFormat)}</strong>
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

  return <ContextMenu {...otherProps} renderHeader={renderHeader} />;
};
