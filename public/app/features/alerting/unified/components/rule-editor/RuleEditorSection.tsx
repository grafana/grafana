import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { FieldSet, useStyles } from '@grafana/ui';
import React, { FC } from 'react';

export interface RuleEditorSectionProps {
  title: string;
  stepNo: number;
  description?: string;
}

export const RuleEditorSection: FC<RuleEditorSectionProps> = ({ title, stepNo, children, description }) => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.parent}>
      <div>
        <span className={styles.stepNo}>{stepNo}</span>
      </div>
      <div className={styles.content}>
        <FieldSet label={title}>
          {description && <p className={styles.description}>{description}</p>}
          {children}
        </FieldSet>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  parent: css`
    display: flex;
    flex-direction: row;
    max-width: ${theme.breakpoints.xl};
  `,
  description: css`
    margin-top: -${theme.spacing.md};
  `,
  stepNo: css`
    display: inline-block;
    width: ${theme.spacing.xl};
    height: ${theme.spacing.xl};
    line-height: ${theme.spacing.xl};
    border-radius: ${theme.spacing.md};
    text-align: center;
    color: ${theme.colors.textStrong};
    background-color: ${theme.colors.bg3};
    font-size: ${theme.typography.size.lg};
    margin-right: ${theme.spacing.md};
  `,
  content: css`
    flex: 1;
  `,
});
