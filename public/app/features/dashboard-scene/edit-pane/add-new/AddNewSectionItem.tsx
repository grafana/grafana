import { css, cx } from '@emotion/css';

import { IconName, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, Button, Icon, Text, useTheme2 } from '@grafana/ui';

type AddNewSectionItemProps = {
  label: string;
  description: string;
  tooltip?: string;
  className?: string;
  icon?: IconName;
  /** Optionally, provide a custom icon as interactive element, to be used for drag&drop */
  iconSlot?: React.ReactNode;
  onClick?: () => void;
};

export function AddNewSectionItem({
  label,
  description,
  tooltip,
  iconSlot,
  icon,
  onClick,
  className,
}: AddNewSectionItemProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  return (
    <div className={cx(styles.container, className)}>
      {iconSlot != null ? (
        iconSlot
      ) : (
        <Button
          variant="secondary"
          fill="outline"
          onClick={onClick!}
          tooltip={tooltip}
          className={getAddNewSectionIconStyles(theme)}
        >
          <Icon name={icon!} size="xl" />
        </Button>
      )}
      <div className={styles.labelAndDescription}>
        <Text weight="medium">{label}</Text>
        <Text element="p" variant="bodySmall" color="secondary">
          {description}
        </Text>
      </div>
    </div>
  );
}

// reused in AddNewEditPane
export function getAddNewSectionIconStyles(theme: GrafanaTheme2) {
  return css({
    height: '46px',
    lineHeight: '46px',
    padding: theme.spacing(0, 1),
    '& svg': {
      opacity: 0.6,
    },
    '&:hover svg': {
      opacity: 1,
    },
  });
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
    labelAndDescription: css({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-evenly',
    }),
  };
}
