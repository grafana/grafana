import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export interface AvatarProps {
  src?: string;
  alt: string;
}
export const Avatar = ({ src, alt }: AvatarProps) => {
  const styles = useStyles2(getStyles);

  if (!src) {
    return null;
  }
  return <img className={styles.image} src={src} alt={alt} />;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    image: css`
      width: ${theme.spacing(3)};
      height: ${theme.spacing(3)};
      border-radius: 50%;
    `,
  };
};
