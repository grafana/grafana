import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, useStyles2 } from '@grafana/ui';

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
      tooltip={t('close-button.tooltip', 'Close')}
    />
  );
};

const getStyles = (theme: GrafanaTheme2) =>
  css({
    position: 'absolute',
    right: theme.spacing(0.5),
    top: theme.spacing(1),
  });
