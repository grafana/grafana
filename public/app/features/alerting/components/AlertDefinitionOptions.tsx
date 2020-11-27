import React from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { Collapse, Field, Input, Label, TextArea, useStyles } from '@grafana/ui';

export const AlertDefinitionOptions = () => {
  const styles = useStyles(getStyles);
  return (
    <div className={styles.container}>
      <Collapse label="Alert definition" isOpen={true}>
        <Field label="Name">
          <Input width={25} />
        </Field>
        <Field label="Description" description="What does the alert do and why was it created">
          <TextArea rows={5} width={25} />
        </Field>
        <Label>Evaluate</Label>
      </Collapse>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      padding: ${theme.spacing.md} 0;
    `,
  };
};
