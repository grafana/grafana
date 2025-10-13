// mostly copy/pasted from: public/app/core/components/CloseButton/CloseButton.tsx
import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { IconButton } from '../../../components/IconButton/IconButton';
import { useStyles2 } from '../../../themes/ThemeContext';

type Props = {
  onClick: () => void;
  'aria-label'?: string;
  style?: React.CSSProperties;
};

export const CloseButton = ({ onClick, 'aria-label': ariaLabel, style }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <IconButton aria-label={ariaLabel ?? 'Close'} className={styles} name="times" onClick={onClick} style={style} />
  );
};

const getStyles = (theme: GrafanaTheme2) =>
  css({
    position: 'absolute',
    margin: '0px',
    right: 5,
    top: 6,
  });
