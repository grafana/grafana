import React from 'react';
import { css } from 'emotion';
import { VariableSuggestion } from '@grafana/data';
import { Button, LegacyForms, DataLinkInput, stylesFactory } from '@grafana/ui';
const { FormField } = LegacyForms;
import { DataLinkConfig } from '../types';

const getStyles = stylesFactory(() => ({
  firstRow: css`
    display: flex;
  `,
  nameField: css`
    flex: 2;
  `,
  regexField: css`
    flex: 3;
  `,
}));

type Props = {
  value: DataLinkConfig;
  onChange: (value: DataLinkConfig) => void;
  onDelete: () => void;
  suggestions: VariableSuggestion[];
  className?: string;
};
export const DataLink = (props: Props) => {
  const { value, onChange, onDelete, suggestions, className } = props;
  const styles = getStyles();

  const handleChange = (field: keyof typeof value) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      [field]: event.currentTarget.value,
    });
  };

  return (
    <div className={className}>
      <div className={styles.firstRow + ' gf-form'}>
        <FormField
          className={styles.nameField}
          labelWidth={6}
          // A bit of a hack to prevent using default value for the width from FormField
          inputWidth={null}
          label="Field"
          type="text"
          value={value.field}
          tooltip={'Can be exact field name or a regex pattern that will match on the field name.'}
          onChange={handleChange('field')}
        />
        <Button
          variant={'destructive'}
          title="Remove field"
          icon="times"
          onClick={event => {
            event.preventDefault();
            onDelete();
          }}
        />
      </div>
      <div className="gf-form">
        <FormField
          label="URL"
          labelWidth={6}
          inputEl={
            <DataLinkInput
              placeholder={'http://example.com/${__value.raw}'}
              value={value.url || ''}
              onChange={newValue =>
                onChange({
                  ...value,
                  url: newValue,
                })
              }
              suggestions={suggestions}
            />
          }
          className={css`
            width: 100%;
          `}
        />
      </div>
    </div>
  );
};
