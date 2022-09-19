import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FieldSet, useStyles2 } from '@grafana/ui';

export interface RuleEditorSectionProps {
  title: string;
  stepNo: number;
  description?: string;
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
      <div>
        <span className={styles.stepNo}>{stepNo}</span>
      </div>
      <div className={styles.content}>
        <FieldSet label={title} className={styles.fieldset}>
          {description && <p className={styles.description}>{description}</p>}
          {children}
        </FieldSet>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  fieldset: css`
    legend {
      font-size: 16px;
      padding-top: ${theme.spacing(0.5)};
    }
  `,
  parent: css`
    display: flex;
    flex-direction: row;
    max-width: ${theme.breakpoints.values.xl};
    & + & {
      margin-top: ${theme.spacing(4)};
    }
  `,
  description: css`
    margin-top: -${theme.spacing(2)};
    color: ${theme.colors.text.secondary};
  `,
  stepNo: css`
    display: inline-block;
    width: ${theme.spacing(4)};
    height: ${theme.spacing(4)};
    line-height: ${theme.spacing(4)};
    border-radius: ${theme.spacing(4)};
    text-align: center;
    color: ${theme.colors.text.maxContrast};
    background-color: ${theme.colors.background.canvas};
    font-size: ${theme.typography.size.lg};
    margin-right: ${theme.spacing(2)};
  `,
  content: css`
    flex: 1;
  `,
});
