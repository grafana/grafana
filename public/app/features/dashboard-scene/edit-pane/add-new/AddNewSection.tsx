import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, useStyles2, Text } from '@grafana/ui';

type AddNewSectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function AddNewSection({ title, description, children }: AddNewSectionProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <Text weight="medium">{title}</Text>
        <Text element="p" variant="bodySmall" color="secondary">
          {description || ''}
        </Text>
      </div>
      <Stack direction="column" gap={2}>
        {children}
      </Stack>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    section: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(2),
    }),
    sectionHeader: css({
      margin: theme.spacing(0, 0, 3, 0),
    }),
  };
}
