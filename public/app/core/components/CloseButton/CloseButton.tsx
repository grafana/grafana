import React from 'react';
import { css } from '@emotion/css';
import { IconButton, useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

type Props = {
  onClick: () => void;
};

export const CloseButton: React.FC<Props> = ({ onClick }) => {
  const styles = useStyles(getStyles);
  return <IconButton className={styles} name="times" onClick={onClick} />;
};

const getStyles = (theme: GrafanaTheme) =>
  css`
    position: absolute;
    right: ${theme.v2.spacing(0.5)};
    top: ${theme.v2.spacing(1)};
  `;
