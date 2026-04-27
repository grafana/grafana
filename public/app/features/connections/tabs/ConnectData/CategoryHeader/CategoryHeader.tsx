import { css } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import type { IconName } from '@grafana/data/types';
import { Icon } from '@grafana/ui/components/icons';
import { useStyles2 } from '@grafana/ui/themes';

const getStyles = (theme: GrafanaTheme2) => ({
  categoryHeader: css({
    alignItems: 'center',
    display: 'flex',
    marginBottom: theme.spacing(3),
  }),
  categoryLabel: css({
    marginBottom: 0,
    marginLeft: theme.spacing(1),
  }),
});

type Props = { iconName: IconName; label: string };

export const CategoryHeader = ({ iconName, label }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.categoryHeader}>
      <Icon name={iconName} size="xl" />
      <h3 className={styles.categoryLabel}>{label}</h3>
    </div>
  );
};
