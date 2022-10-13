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

  const containerStyles: CSSProperties = { width, height };

  return (
    <div className={styles.container} style={containerStyles}>
      <div className={styles.header} style={headerStyles}>
        <div className={styles.headerTitle}>{title}</div>
        <div className={styles.iconItem}>{<Icon name="info-circle" size="sm" />}</div>
        <div className={styles.iconItem}>{<Icon name="link" size="sm" />}</div>
        <div className={styles.iconItem}>{<Icon name="clock-nine" size="sm" />}</div>
        <div className={styles.iconItem}>{<Icon name="heart-rate" size="sm" />}</div>
        {itemsRenderer(leftItems, (items) => {
          return <div className={styles.leftItems}>{items}</div>;
        })}
      </div>
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
    header: css({
      label: 'panel-header',
      display: 'flex',
      alignItems: 'center',
    }),
    headerTitle: css({
      label: 'panel-header',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      paddingLeft: theme.spacing(padding),
      fontWeight: theme.typography.fontWeightMedium,
    }),
    iconItem: css({
      label: 'panel-header',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      paddingLeft: theme.spacing(padding),
      fontWeight: theme.typography.fontWeightMedium,
    }),
    leftItems: css({
      display: 'flex',
      paddingRight: theme.spacing(padding),
    }),
  };
};
