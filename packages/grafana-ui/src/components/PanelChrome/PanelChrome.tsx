import { css } from '@emotion/css';
import React, { CSSProperties, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes';

/**
 * @internal
 */
export interface PanelChromeProps {
  width: number;
  height: number;
  title?: string;
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
  children,
  width,
  height,
  padding = 'md',
  leftItems = [],
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
    container: css`
      label: panel-container;
      background-color: ${background};
      border: 1px solid ${borderColor};
      position: relative;
      border-radius: 3px;
      height: 100%;
      display: flex;
      flex-direction: column;
      flex: 0 0 0;
    `,
    content: css`
      label: panel-content;
      width: 100%;
      flex-grow: 1;
    `,
    header: css`
      label: panel-header;
      display: flex;
      align-items: center;
    `,
    headerTitle: css`
      label: panel-header;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      padding-left: ${theme.spacing(padding)};
      flex-grow: 1;
      font-weight: ${theme.typography.fontWeightMedium};
    `,
    leftItems: css`
      display: flex;
      padding-right: ${theme.spacing(padding)};
    `,
  };
};
