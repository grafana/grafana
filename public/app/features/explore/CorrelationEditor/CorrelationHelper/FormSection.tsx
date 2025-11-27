import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, Text, useStyles2 } from '@grafana/ui';

import { FormSectionProps } from '../types';

export const FormSection = ({ title, children }: FormSectionProps) => {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={2}>
      <Text variant="h5">{title}</Text>
      <div className={styles.formFieldsWrapper}>
        <Stack direction="column" gap={1.5}>
          {children}
        </Stack>
      </div>
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  formFieldsWrapper: css({
    padding: theme.spacing(2),
    backgroundColor: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
});
