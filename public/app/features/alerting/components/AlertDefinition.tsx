import React, { useState } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { Collapse, Field, Input, TextArea, useStyles } from '@grafana/ui';

export const AlertDefinition = () => {
  const styles = useStyles(getStyles);
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className={styles.container}>
      <Collapse label="Alert definition" collapsible isOpen={isOpen} onToggle={setIsOpen}>
        <Field label="Name">
          <Input width={25} />
        </Field>
        <Field label="Description" description="What does the alert do and why was it created">
          <TextArea rows={5} width={25} />
        </Field>
      </Collapse>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      padding: 0 ${theme.spacing.md};
      background-color: ${theme.colors.panelBg};
    `,
  };
};
