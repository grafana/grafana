import { css } from '@emotion/css';
import React, { ReactElement } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { FieldSet, Text, useStyles2 } from '@grafana/ui';

export interface RuleEditorSectionProps {
  title: string;
  stepNo: number;
  description?: string | ReactElement;
}

export const RuleEditorSection = ({
  title,
  stepNo,
  children,
  description,
}: React.PropsWithChildren<RuleEditorSectionProps>) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.parent}>
      <FieldSet
        label={
          <Text variant="h3">
            {stepNo}. {title}
          </Text>
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
  parent: css`
    display: flex;
    flex-direction: row;
    max-width: ${theme.breakpoints.values.xl};
    border: solid 1px ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
    padding: ${theme.spacing(2)} ${theme.spacing(3)};
  `,
  description: css`
    margin-top: -${theme.spacing(2)};
  `,
});
