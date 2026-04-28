import { css, cx } from '@emotion/css';

import { type IconName, type GrafanaTheme2 } from '@grafana/data';
import { Button } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

type AddButtonProps = {
  icon: IconName;
  label: string;
  onClick: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  tooltip?: string;
  className?: string;
  tabIndex?: number;
  // When disabled, callers should set tooltip to explain why.
  disabled?: boolean;
};

export function AddButton({ icon, label, tooltip, tabIndex, onClick, onKeyDown, className, disabled }: AddButtonProps) {
  const styles = useStyles2(getStyles);
  return (
    <Button
      className={cx(styles.iconButton, className)}
      variant="secondary"
      fill="outline"
      size="lg"
      tabIndex={tabIndex}
      icon={icon}
      tooltip={tooltip}
      onClick={onClick}
      onKeyDown={onKeyDown}
      disabled={disabled}
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
