import { css, cx } from '@emotion/css';
import * as React from 'react';
import { ReactElement } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FieldSet, Stack, Text, useStyles2 } from '@grafana/ui';

export interface StackFormSectionProps {
  title: string;
  stepNo: number;
  description?: string | ReactElement;
  fullWidth?: boolean;
}

export const StackFormSection = ({
  title,
  stepNo,
  children,
  fullWidth = false,
  description,
}: React.PropsWithChildren<StackFormSectionProps>) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.parent}>
      <FieldSet
        className={cx(fullWidth && styles.fullWidth)}
        label={
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Text variant="h3">
              {stepNo}. {title}
            </Text>
          </Stack>
        }
      >
        <Stack direction="column">
          {description && <div className={styles.description}>{description}</div>}
          {children}
        </Stack>
      </FieldSet>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  parent: css({
    display: 'flex',
    flexDirection: 'row',
    border: `solid 1px ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.lg,
    padding: `${theme.spacing(2)} ${theme.spacing(3)}`,
  }),
  description: css({
    marginTop: `-${theme.spacing(2)}`,
  }),
  fullWidth: css({
    width: '100%',
  }),
  reverse: css({
    flexDirection: 'row-reverse',
    gap: theme.spacing(1),
  }),
});
