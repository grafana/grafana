import { css, cx } from '@emotion/css';

import { IconName, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Button } from '@grafana/ui';

type AddButtonProps = {
  icon: IconName;
  label: string;
  onClick: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  tooltip?: string;
  className?: string;
};

export function AddButton({ icon, label, tooltip, onClick, onKeyDown, className }: AddButtonProps) {
  const styles = useStyles2(getStyles);
  return (
    <Button
      className={cx(styles.iconButton, className)}
      variant="secondary"
      fill="outline"
      size="lg"
      icon={icon}
      tooltip={tooltip}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {label}
    </Button>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    iconButton: css({
      display: 'flex',
      padding: theme.spacing(1.5),
      gap: theme.spacing(1.5),
      alignItems: 'center',
      fontSize: '14px',
      '&:hover': {
        background: theme.colors.background.elevated,
        boxShadow: theme.shadows.z1,
      },
    }),
  };
}
