import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import React from 'react';
import { useStyles2 } from '../../themes/ThemeContext';
import { IconName } from '../../types/icon';
import { Icon } from '../Icon/Icon';

type MenuItemLabelProps = {
  label: string;
  icon?: IconName;
  imgSrc?: string;
};

export function MenuItemLabel(props: MenuItemLabelProps): JSX.Element | null {
  const { imgSrc, label, icon } = props;
  const styles = useStyles2(getStyles);

  if (icon) {
    return (
      <>
        <Icon name={icon} className={styles.icon} /> {label}
      </>
    );
  }

  if (imgSrc) {
    return (
      <>
        <img className={styles.img} src={imgSrc} /> {label}
      </>
    );
  }

  return <>{label}</>;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    icon: css`
      opacity: 0.7;
      margin-right: 10px;
      color: ${theme.colors.text.secondary};
    `,
    img: css`
      width: 16px;
      height: 16px;
      margin-right: ${theme.spacing(1)};
    `,
  };
};
