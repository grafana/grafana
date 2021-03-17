import React, { useState } from 'react';
import { FieldSet, Field, Label, Select, TextArea, stylesFactory, Input, Button } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { config } from 'app/core/config';
import { css } from 'emotion';
import AlertLabels from './AlertLabels';

interface Props {}

const AlertDetails = (props: Props) => {
  const annotationKey = useSelect();
  const styles = getStyles(config.theme);
  const annotationOptions = ['Summary', 'Description'].map((value) => ({ value, label: value }));
  return (
    <FieldSet label="Add details for your alert">
      <Label>Summary and annotations</Label>
      <div className={styles.flexRow}>
        <Field className={styles.formInput}>
          <Select {...annotationKey} options={annotationOptions} />
        </Field>
        <Field className={styles.formInput}>
          <TextArea name="summary" placeholder={`Enter ${annotationKey.value?.toLowerCase() || ''} here`} />
        </Field>
      </div>
      <Button type="button" variant="secondary" size="sm">
        Add annotation
      </Button>
      <AlertLabels />
    </FieldSet>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    formInput: css`
      width: 400px;
      & + & {
        margin-left: ${theme.spacing.sm};
      }
    `,
    flexRow: css`
      display: flex;
      flex-direction: row;
      justify-content: flex-start;
    `,
  };
});

const useSelect = (initialValue?: string) => {
  const [value, setValue] = useState(initialValue);
  const handleChange = (option: { value: string; label: string; description?: string }) => {
    setValue(option.value);
  };

  return { value, onChange: handleChange };
};

export default AlertDetails;
