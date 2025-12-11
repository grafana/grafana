import { css } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

interface OpenDrawerIconButtonProps {
  onClick: () => void;
  ['aria-label']: string;
}

export const OpenDrawerIconButton = memo(function OpenDrawerIconButton({
  onClick,
  ['aria-label']: ariaLabel,
}: OpenDrawerIconButtonProps) {
  const styles = useStyles2(getStyles);
  return <IconButton className={styles.iconButton} name="web-section-alt" aria-label={ariaLabel} onClick={onClick} />;
});

const getStyles = (theme: GrafanaTheme2) => ({
  iconButton: css({
    transform: 'rotate(180deg)',
  }),
});
