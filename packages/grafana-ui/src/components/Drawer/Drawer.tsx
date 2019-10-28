import React, { FC, ReactNode } from 'react';
import RcDrawer from 'rc-drawer';
import { css, cx } from 'emotion';
import { getTheme, stylesFactory } from '../../themes';
import { GrafanaTheme } from '../../types';

interface Props {
  title: string;
  children: ReactNode;
  parentContainer?: HTMLElement | string;

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

export const Drawer: FC<Props> = ({ children, parentContainer = 'body', onClose, title }) => {
  const theme = getTheme();
  const drawerStyles = getStyles(theme);
  return (
    <RcDrawer
      onClose={onClose}
      handler={false}
      open={true}
      maskClosable={true}
      placement="right"
      width="30%"
      getContainer={parentContainer}
    >
      <div className={drawerStyles.titleContainer}>
        {title} <i className={cx('fa fa-close', drawerStyles.close)} onClick={onClose} />
      </div>
      {children}
    </RcDrawer>
  );
};
