import { css } from '@emotion/css';
import React, { CSSProperties, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes';
import { Icon } from '../Icon/Icon';

/**
 * @internal
 */
export interface PanelChromeProps {
  title?: string;
  description?: string;
  link?: string;
  timeshift?: string;
  health?: string;
  state?: string;
  width: number;
  height: number;
  padding?: PanelPadding;
  leftItems?: React.ReactNode[]; // rightItems will be added later (actions links etc.)
  children: (innerWidth: number, innerHeight: number) => React.ReactNode;
}

/**
 * @internal
 */
export type PanelPadding = 'none' | 'md';

/**
 * @internal
 */
export const PanelChrome: React.FC<PanelChromeProps> = ({
  title = '',
  description = '',
  link = '',
  timeshift = '',
  health = '',
  state = '',
  width,
  height,
  padding = 'md',
  leftItems = [],
  children,
}) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const headerHeight = getHeaderHeight(theme, title, leftItems);
  const { contentStyle, innerWidth, innerHeight } = getContentStyle(padding, theme, width, headerHeight, height);

  const headerStyles: CSSProperties = {
    height: headerHeight,
  };
  const iconStyles: CSSProperties = {
    minHeight: headerHeight,
    minWidth: headerHeight,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
  };
  const containerStyles: CSSProperties = { width, height };

  return (
    <div className={styles.container} style={containerStyles}>
      {
        title.length > 0 && (
          <div className={styles.headerContainer} style={headerStyles}>
            <div className={styles.title}>{title}</div>
            <div className={styles.view}>
              {
                <div style={iconStyles}>
                  <Icon name="info-circle" size="sm" />
                </div>
              }
              {
                <div style={iconStyles}>
                  <Icon name="external-link-alt" size="sm" />
                </div>
              }
            </div>
            <div className={styles.edit}>
              {
                <div style={iconStyles}>
                  <Icon name="clock-nine" size="sm" />
                </div>
              }
              {
                <div style={iconStyles}>
                  <Icon name="heart" size="sm" />
                </div>
              }
            </div>
            <div className={styles.menu}>
              {
                <div style={iconStyles}>
                  <Icon name="ellipsis-v" size="sm" />
                </div>
              }
            </div>
            <div className={styles.dragSpace}></div>
            <div className={styles.status}>
              {<Icon name="fa fa-spinner" size="sm" />}
              {/* <PanelHeaderLoadingIndicator state={data.state} onClick={onCancelQuery} /> */}
            </div>

            {/* {itemsRenderer(leftItems, (items) => {
              return <div className={styles.leftItems}>{items}</div>;
            })} */}
          </div>
        )
        // : (
        //   // TODO: Create headerless behavior (title, menu, etc shown on focus/hover, drag handler is present, etc..)
        //   <div className={styles.headerContainer} style={headerStyles}>
        //     <div className={styles.dragIcon}>{<Icon name="draggabledots" size="sm" />}</div>
        //     <div className={styles.edit}>
        //       {<Icon name="clock-nine" size="sm" />}
        //       {<Icon name="heart-rate" size="sm" />}
        //     </div>
        //     <div className={styles.menu}>{<Icon name="ellipsis-v" size="sm" />}</div>
        //     <div className={styles.status}>{<Icon name="fa fa-spinner" size="sm" />}</div>
        //   </div>
        // )
      }

      <div className={styles.content} style={contentStyle}>
        {children(innerWidth, innerHeight)}
      </div>
    </div>
  );
};

const itemsRenderer = (items: ReactNode[], renderer: (items: ReactNode[]) => ReactNode): ReactNode => {
  const toRender = React.Children.toArray(items).filter(Boolean);
  return toRender.length > 0 ? renderer(toRender) : null;
};

const getHeaderHeight = (theme: GrafanaTheme2, title: string, items: ReactNode[]) => {
  if (title.length > 0 || items.length > 0) {
    return theme.spacing.gridSize * theme.components.panel.headerHeight;
  }
  return 0;
};

const getContentStyle = (
  padding: string,
  theme: GrafanaTheme2,
  width: number,
  headerHeight: number,
  height: number
) => {
  const chromePadding = (padding === 'md' ? theme.components.panel.padding : 0) * theme.spacing.gridSize;
  const panelBorder = 1 * 2;
  const innerWidth = width - chromePadding * 2 - panelBorder;
  const innerHeight = height - headerHeight - chromePadding * 2 - panelBorder;

  const contentStyle: CSSProperties = {
    padding: chromePadding,
  };

  return { contentStyle, innerWidth, innerHeight };
};

const getStyles = (theme: GrafanaTheme2) => {
  const { padding, background, borderColor } = theme.components.panel;

  return {
    container: css({
      label: 'panel-container',
      backgroundColor: background,
      border: `1px solid ${borderColor}`,
      position: 'relative',
      borderRadius: '3px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      flex: '0 0 0',
    }),
    content: css({
      label: 'panel-content',
      width: '100%',
      flexGrow: 1,
    }),
    headerContainer: css({
      label: 'panel-header',
      display: 'flex',
      alignItems: 'center',
      padding: `0 ${theme.spacing(padding)}`,
    }),
    title: css({
      label: 'panel-title',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      fontWeight: theme.typography.fontWeightMedium,
    }),
    view: css({
      display: 'flex',
    }),
    edit: css({
      display: 'flex',
    }),
    menu: css({
      display: 'flex',
    }),
    dragSpace: css({
      flexBasis: `30%`,
      width: '100%',
    }),
    status: css({
      display: 'flex',
      marginLeft: 'auto',
    }),
    leftItems: css({
      display: 'flex',
      paddingRight: theme.spacing(padding),
    }),
  };
};
