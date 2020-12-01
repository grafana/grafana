import React, { FC, FormEvent } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { Field, Input, Label, TextArea, useStyles } from '@grafana/ui';
import { AlertDefinition } from 'app/types';

interface Props {
  alertDefinition: AlertDefinition;
  onChange: (event: FormEvent) => void;
}

export const AlertDefinitionOptions: FC<Props> = ({ alertDefinition, onChange }) => {
  const styles = useStyles(getStyles);
  return (
    <div className={styles.container}>
      <h4>Alert definition</h4>
      <Field label="Name">
        <Input width={25} name="name" value={alertDefinition.name} onChange={onChange} />
      </Field>
      <Field label="Description" description="What does the alert do and why was it created">
        <TextArea rows={5} width={25} name="description" value={alertDefinition.description} onChange={onChange} />
      </Field>
      <Label>Evaluate</Label>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      padding: ${theme.spacing.md};
      background-color: ${theme.colors.panelBg};
    `,
  };
};
