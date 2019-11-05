import React from 'react';
import { css } from 'emotion';
import { Button, FormField, VariableSuggestion, DataLinkInput, stylesFactory } from '@grafana/ui';
import { DerivedFieldConfig } from '../types';

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
  value: DerivedFieldConfig;
  onChange: (value: DerivedFieldConfig) => void;
  onDelete: () => void;
  suggestions: VariableSuggestion[];
  className?: string;
};
export const DerivedField = (props: Props) => {
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
      <div className={styles.firstRow}>
        <FormField
          className={styles.nameField}
          labelWidth={5}
          // A bit of a hack to prevent using default value for the width from FormField
          inputWidth={null}
          label="Pattern"
          type="text"
          value={value.pattern}
          onChange={handleChange('pattern')}
        />
        <Button
          variant={'inverse'}
          title="Remove field"
          icon={'fa fa-times'}
          onClick={event => {
            event.preventDefault();
            onDelete();
          }}
        />
      </div>

      <FormField
        label="URL"
        labelWidth={5}
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
  );
};
