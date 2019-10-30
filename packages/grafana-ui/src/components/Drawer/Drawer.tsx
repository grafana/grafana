import React, { CSSProperties, FC, ReactNode } from 'react';
import RcDrawer from 'rc-drawer';
import { css } from 'emotion';
import { stylesFactory, useTheme } from '../../themes';
import { GrafanaTheme } from '../../types';

interface Props {
  children: ReactNode;
  /** Title shown at the top of the drawer */
  title?: string;
  /** Should the Drawer be closable by clicking on the mask */
  closeOnMaskClick?: boolean;
  /** Render the drawer inside a container on the page */
  inline?: boolean;
  /** width in percentage of the container */
  width?: number;

  onClose: () => void;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const closeButtonWidth = '50px';

  return {
    drawer: css`
      .drawer-content {
        background-color: ${theme.colors.bodyBg};
      }
    `,
    titleWrapper: css`
      font-size: ${theme.typography.size.lg};
      display: flex;
      align-items: center;
      border-bottom: 1px solid ${theme.colors.white};
      padding: ${theme.spacing.md} ${theme.spacing.sm};
      background-color: ${theme.colors.bodyBg};
      position: sticky;
      top: 0;
    `,
    title: css`
      width: calc(100% - ${closeButtonWidth});
    `,
    close: css`
      cursor: pointer;
      width: ${closeButtonWidth};
      height: 100%;
      display: flex;
      justify-content: center;
    `,
    content: css`
      padding: ${theme.spacing.md};
    `,
  };
});

export const Drawer: FC<Props> = ({
  children,
  inline = false,
  onClose,
  closeOnMaskClick = false,
  title,
  width = 40,
}) => {
  const theme = useTheme();
  const drawerStyles = getStyles(theme);

  return (
    <RcDrawer
      level={null}
      handler={false}
      open={true}
      onClose={onClose}
      maskClosable={closeOnMaskClick}
      placement="right"
      width={`${width}%`}
      getContainer={inline ? false : 'body'}
      style={{ position: `${inline && 'absolute'}` } as CSSProperties}
      className={drawerStyles.drawer}
    >
      <div className={drawerStyles.titleWrapper}>
        <div className={drawerStyles.title}>{title}</div>
        <div className={drawerStyles.close} onClick={onClose}>
          <i className="fa fa-close" />
        </div>
      </div>
      <div className={drawerStyles.content}>{children}</div>
    </RcDrawer>
  );
};
