import { css } from '@emotion/css';
import { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { Button } from '../Button/Button';
import { IconButton } from '../IconButton/IconButton';
import { Stack } from '../Layout/Stack/Stack';
import { Text } from '../Text/Text';

export interface Props {
  children?: ReactNode;
  title: string;
  onClose?: () => void;
}

export function SidebarPaneHeader({ children, onClose, title }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <Stack direction="row" gap={1}>
        {onClose && <IconButton variant="secondary" size="lg" name="times" onClick={onClose} tooltip="Close" />}
        <Text weight="medium" variant="h6">
          {title}
        </Text>
      </Stack>
      <Stack direction="row" gap={1} justifyContent={'flex-end'} alignItems={'center'}>
        {children}
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
      padding: theme.spacing(1.5),
      height: theme.spacing(6),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
  };
};
