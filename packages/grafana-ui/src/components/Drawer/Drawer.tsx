import React, { CSSProperties, FC, ReactNode } from 'react';
import RcDrawer from 'rc-drawer';
import { css, cx } from 'emotion';
import { getTheme, stylesFactory } from '../../themes';
import { GrafanaTheme } from '../../types';

interface Props {
  children: ReactNode;
  /** Title shown at the top of the drawer */
  title?: string;
  /** Should the Drawer be closable by clicking on the mask */
  maskClosable?: boolean;
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
}));

export const Drawer: FC<Props> = ({ children, inline = false, onClose, maskClosable = false, title, width = 30 }) => {
  const theme = getTheme();
  const drawerStyles = getStyles(theme);

  return (
    <RcDrawer
      level={null}
      onClose={onClose}
      handler={false}
      open={true}
      maskClosable={maskClosable}
      placement="right"
      width={`${width}%`}
      getContainer={inline ? false : 'body'}
      style={{ position: `${inline && 'absolute'}` } as CSSProperties}
    >
      <div className={drawerStyles.titleContainer}>
        {title} <i className={cx('fa fa-close', drawerStyles.close)} onClick={onClose} />
      </div>
      {children}
    </RcDrawer>
  );
};
