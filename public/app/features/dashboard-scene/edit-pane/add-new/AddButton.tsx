import { css } from '@emotion/css';

import { IconName, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Button } from '@grafana/ui';

type AddButtonProps = {
  icon: IconName;
  label: string;
  onClick: () => void;
  tooltip?: string;
};

export function AddButton({ icon, label, tooltip, onClick }: AddButtonProps) {
  const styles = useStyles2(getStyles);
  return (
    <Button
      className={styles.iconButton}
      variant="secondary"
      fill="outline"
      size="lg"
      icon={icon}
      tooltip={tooltip}
      onClick={onClick}
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
