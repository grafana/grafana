// mostly copy/pasted from: public/app/core/components/CloseButton/CloseButton.tsx
import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from 'src';
import { IconButton } from 'src/components/IconButton/IconButton';

import { GrafanaTheme2 } from '@grafana/data';

type Props = {
  onClick: () => void;
  'aria-label'?: string;
  style?: React.CSSProperties;
};

export const CloseButton = ({ onClick, 'aria-label': ariaLabel, style }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <IconButton
      aria-label={ariaLabel ?? 'Close'}
      className={styles}
      name="times"
      onClick={onClick}
      style={style}
      tooltip="Close"
    />
  );
};

const getStyles = (theme: GrafanaTheme2) =>
  css({
    position: 'absolute',
    right: theme.spacing(0.5),
    top: theme.spacing(1),
  });
