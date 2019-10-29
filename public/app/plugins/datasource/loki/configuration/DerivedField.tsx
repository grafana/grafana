import React from 'react';
import { css } from 'emotion';
import { Button, FormField, VariableSuggestion } from '@grafana/ui';
import { DerivedFieldConfig } from '../types';
// TODO: fix import
import { DataLinkInput } from '@grafana/ui/src/components/DataLinks/DataLinkInput';

type Props = {
  value: DerivedFieldConfig;
  onChange: (value: DerivedFieldConfig) => void;
  onDelete: () => void;
  suggestions: VariableSuggestion[];
};
export const DerivedField = (props: Props) => {
  const { value, onChange, onDelete, suggestions } = props;

  const handleChange = (field: keyof typeof value) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      [field]: event.currentTarget.value,
    });
  };

  return (
    <>
      <div
        className={css`
          display: flex;
        `}
      >
        <FormField label="name" type="text" value={value.name} onChange={handleChange('name')} />
        <FormField
          label="Regex"
          type="text"
          value={value.matcherRegex}
          onChange={handleChange('matcherRegex')}
          tooltip={
            'Use to parse and capture some part of the log message. You can use the captured groups in the template.'
          }
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
    </>
  );
};
