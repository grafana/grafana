import React, { CSSProperties, FC, ReactNode } from 'react';
import { GrafanaTheme } from '@grafana/data';
import RcDrawer from 'rc-drawer';
import { css } from 'emotion';
import CustomScrollbar from '../CustomScrollbar/CustomScrollbar';
import { stylesFactory, useTheme, selectThemeVariant } from '../../themes';

export interface Props {
  children: ReactNode;
  /** Title shown at the top of the drawer */
  title?: (() => JSX.Element) | string;
  /** Should the Drawer be closable by clicking on the mask */
  closeOnMaskClick?: boolean;
  /** Render the drawer inside a container on the page */
  inline?: boolean;
  /** Either a number in px or a string with unit postfix */
  width?: number | string;

  /** Set to true if the component rendered within in drawer content has its own scroll */
  scrollableContent?: boolean;

  onClose: () => void;
}

const getStyles = stylesFactory((theme: GrafanaTheme, scollableContent: boolean) => {
  const closeButtonWidth = '50px';
  const borderColor = selectThemeVariant(
    {
      light: theme.colors.gray4,
      dark: theme.colors.dark9,
    },
    theme.type
  );
  return {
    drawer: css`
      .drawer-content {
        background-color: ${theme.colors.bodyBg};
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
    `,
    titleWrapper: css`
      font-size: ${theme.typography.size.lg};
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      border-bottom: 1px solid ${borderColor};
      padding: ${theme.spacing.sm} 0 ${theme.spacing.sm} ${theme.spacing.md};
      background-color: ${theme.colors.bodyBg};
      top: 0;
      z-index: 1;
      flex-grow: 0;
    `,
    close: css`
      cursor: pointer;
      width: ${closeButtonWidth};
      height: 100%;
      display: flex;
      flex-shrink: 0;
      justify-content: center;
    `,
    content: css`
      padding: ${theme.spacing.md};
      flex-grow: 1;
      overflow: ${!scollableContent ? 'hidden' : 'auto'};
      z-index: 0;
    `,
  };
});

export const Drawer: FC<Props> = ({
  children,
  inline = false,
  onClose,
  closeOnMaskClick = false,
  scrollableContent = false,
  title,
  width = '40%',
}) => {
  const theme = useTheme();
  const drawerStyles = getStyles(theme, scrollableContent);

  return (
    <RcDrawer
      level={null}
      handler={false}
      open={true}
      onClose={onClose}
      maskClosable={closeOnMaskClick}
      placement="right"
      width={width}
      getContainer={inline ? false : 'body'}
      style={{ position: `${inline && 'absolute'}` } as CSSProperties}
      className={drawerStyles.drawer}
    >
      {typeof title === 'string' && (
        <div className={drawerStyles.titleWrapper}>
          <div>{title}</div>
          <div className={drawerStyles.close} onClick={onClose}>
            <i className="fa fa-close" />
          </div>
        </div>
      )}
      {typeof title === 'function' && title()}
      <div className={drawerStyles.content}>
        {!scrollableContent ? children : <CustomScrollbar>{children}</CustomScrollbar>}
      </div>
    </RcDrawer>
  );
};
