import React, { CSSProperties } from 'react';
import { css } from 'emotion';
import { stylesFactory, useTheme } from '../../themes';
import { GrafanaTheme } from '@grafana/data';

export interface Props {
  title: string;
  width: number;
  height: number;
  padding?: 'none' | 'md';
  children: (innerWidth: number, innerHeight: number) => React.ReactNode;
}

export const PanelChrome: React.FC<Props> = ({ title, children, width, height, padding = 'md' }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const chromePadding = padding === 'md' ? theme.panelPadding : 0;
  const panelBorder = 1 * 2;
  const innerWidth = width - chromePadding * 2 - panelBorder;
  const hasTitle = title && title.length > 0;
  const headerHeight = hasTitle ? theme.panelHeaderHeight : 0;
  const innerHeight = height - headerHeight - chromePadding * 2 - panelBorder;

  const contentStyle: CSSProperties = {
    padding: chromePadding,
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>{title}</div>
      <div className={styles.content} style={contentStyle}>
        {children(innerWidth, innerHeight)}
      </div>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  console.log('getStyles');
  return {
    container: css`
      label: panel-container;
      background-color: ${theme.colors.panelBg};
      border: 1px solid ${theme.colors.panelBorder};
      position: relative;
      border-radius: 3px;
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column;
      flex: 1 1 0;
    `,
    content: css`
      label: panel-content;
      width: 100%;
      flex-grow: 1;
    `,
    header: css`
      label: panel-header;
      display: inline-block;
      padding-left: 10px;
      margin-bottom: 5px;
    `,
  };
});
