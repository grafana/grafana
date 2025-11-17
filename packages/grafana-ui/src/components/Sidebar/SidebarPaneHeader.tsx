import { css } from '@emotion/css';
import { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { Button } from '../Button/Button';
import { Stack } from '../Layout/Stack/Stack';

export interface Props {
  children?: ReactNode;
  title: string | ReactNode;
  onClose?: () => void;
}

export function SidebarPaneHeader({ children, onClose, title }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <Stack direction="row" gap={0.5}>
        {title}
      </Stack>
      <Stack direction="row" gap={1}>
        {children}
        {onClose && <Button variant="secondary" fill="text" size="sm" icon="times" onClick={onClose} tooltip="Close" />}
      </Stack>
    </div>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(1, 1.5),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
  };
};
