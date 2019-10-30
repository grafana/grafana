import React, { CSSProperties, FC, ReactNode } from 'react';
import RcDrawer from 'rc-drawer';
import { css, cx } from 'emotion';
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

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  titleContainer: css`
    font-size: ${theme.typography.size.lg};
    display: flex;
    justify-content: space-between;
    align-items: center;
  `,
  close: css`
    cursor: pointer;
  `,
  drawer: css`
    .drawer-content {
      padding: ${theme.spacing.sm} ${theme.spacing.md};
      background-color: ${theme.colors.bodyBg};
    }
  `,
}));

export const Drawer: FC<Props> = ({
  children,
  inline = false,
  onClose,
  closeOnMaskClick = false,
  title,
  width = 30,
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
      <div className={drawerStyles.titleContainer}>
        {title} <i className={cx('fa fa-close', drawerStyles.close)} onClick={onClose} />
      </div>
      {children}
    </RcDrawer>
  );
};
