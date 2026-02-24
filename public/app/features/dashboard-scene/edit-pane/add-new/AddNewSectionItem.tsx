import { css } from '@emotion/css';

import { IconName, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Button, Icon, Text } from '@grafana/ui';

type AddNewSectionItemProps = {
  icon: IconName;
  label: string;
  description: string;
  tooltip: string;
  onClick: () => void;
};

export function AddNewSectionItem({ icon, label, description, tooltip, onClick }: AddNewSectionItemProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.container}>
      <Button variant="secondary" fill="outline" onClick={onClick} tooltip={tooltip} className={styles.iconButton}>
        <Icon name={icon} size="xl" />
      </Button>
      <div className={styles.labelAndDescription}>
        <Text weight="medium">{label}</Text>
        <Text element="p" variant="bodySmall" color="secondary">
          {description}
        </Text>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(2),
      alignItems: 'stretch',
      width: '100%',
    }),
    iconButton: css({
      height: '46px',
      lineHeight: '46px',
      padding: theme.spacing(0, 1),
      '& svg': {
        opacity: 0.6,
      },
      '&:hover svg': {
        opacity: 1,
      },
    }),
    labelAndDescription: css({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-evenly',
    }),
  };
}
