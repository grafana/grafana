import React, { CSSProperties } from 'react';
import { css } from 'emotion';
import { stylesFactory, useTheme } from '../../themes';
import { GrafanaTheme } from '@grafana/data';

export interface Props {
  title: string;
  width: number;
  height: number;
  padding?: PanelPadding;
  children: (innerWidth: number, innerHeight: number) => React.ReactNode;
}

export type PanelPadding = 'none' | 'md';

export const PanelChrome: React.FC<Props> = ({ title, children, width, height, padding = 'md' }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const { contentStyle, innerWidth, innerHeight } = getContentStyle(padding, theme, width, title, height);

  const headerStyles: CSSProperties = {
    height: theme.panelHeaderHeight,
  };

  const containerStyles: CSSProperties = { width, height };

  return (
    <div className={styles.container} style={containerStyles}>
      <div className={styles.header} style={headerStyles}>
        <div className={styles.headerTitle}>{title}</div>
      </div>
      <div className={styles.content} style={contentStyle}>
        {children(innerWidth, innerHeight)}
      </div>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      label: panel-container;
      background-color: ${theme.colors.panelBg};
      border: 1px solid ${theme.colors.panelBorder};
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
      padding-left: ${theme.panelPadding}px;
      flex-grow: 1;
    `,
  };
});
function getContentStyle(padding: string, theme: GrafanaTheme, width: number, title: string, height: number) {
  const chromePadding = padding === 'md' ? theme.panelPadding : 0;
  const panelBorder = 1 * 2;
  const innerWidth = width - chromePadding * 2 - panelBorder;
  const hasTitle = title && title.length > 0;
  const headerHeight = hasTitle ? theme.panelHeaderHeight : 0;
  const innerHeight = height - headerHeight - chromePadding * 2 - panelBorder;

  const contentStyle: CSSProperties = {
    padding: chromePadding,
  };

  return { contentStyle, innerWidth, innerHeight };
}
