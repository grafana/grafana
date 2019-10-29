import React, { useState } from 'react';
import { css } from 'emotion';
import cx from 'classnames';
import {
  Button,
  DataLinkBuiltInVars,
  DataSourceHttpSettings,
  DataSourcePluginOptionsEditorProps,
  DataSourceSettings,
  FormField,
  VariableOrigin,
  VariableSuggestion,
} from '@grafana/ui';
import { DerivedFieldConfig, LokiOptions } from '../types';
// TODO: fix import
import { DataLinkInput } from '@grafana/ui/src/components/DataLinks/DataLinkInput';

export type Props = DataSourcePluginOptionsEditorProps<LokiOptions>;

const makeJsonUpdater = <T extends any>(field: keyof LokiOptions) => (
  options: DataSourceSettings<LokiOptions>,
  value: T
): DataSourceSettings<LokiOptions> => {
  return {
    ...options,
    jsonData: {
      ...options.jsonData,
      [field]: value,
    },
  };
};

const setMaxLines = makeJsonUpdater('maxLines');
const setDerivedFields = makeJsonUpdater('derivedFields');

export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;

  return (
    <>
      <DataSourceHttpSettings
        defaultUrl={'http://localhost:3100'}
        dataSourceConfig={options}
        showAccessOptions={false}
        onChange={onOptionsChange}
      />

      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <MaxLinesField
              value={options.jsonData.maxLines}
              onChange={value => onOptionsChange(setMaxLines(options, value))}
            />
          </div>
        </div>
      </div>

      <DerivedFields
        value={options.jsonData.derivedFields}
        onChange={value => onOptionsChange(setDerivedFields(options, value))}
      />
    </>
  );
};

type MaxLinesFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

const MaxLinesField = (props: MaxLinesFieldProps) => {
  const { value, onChange } = props;
  return (
    <FormField
      label="Maximum lines"
      labelWidth={11}
      inputWidth={20}
      inputEl={
        <input
          type="number"
          className="gf-form-input width-8 gf-form-input--has-help-icon"
          value={value}
          onChange={event => onChange(event.currentTarget.value)}
          spellCheck={false}
          placeholder="1000"
        />
      }
      tooltip={
        <>
          Loki queries must contain a limit of the maximum number of lines returned (default: 1000). Increase this limit
          to have a bigger result set for ad-hoc analysis. Decrease this limit if your browser becomes sluggish when
          displaying the log results.
        </>
      }
    />
  );
};

type DerivedFieldsProps = {
  value: DerivedFieldConfig[] | undefined;
  onChange: (value: DerivedFieldConfig[]) => void;
};
const DerivedFields = (props: DerivedFieldsProps) => {
  const { value, onChange } = props;
  return (
    <>
      <h3 className="page-heading">Derived fields</h3>

      <DebugSection
        className={css`
          margin-bottom: 10px;
        `}
        derivedFields={value}
      />

      <div className="gf-form-group">
        {value &&
          value.map((field, index) => {
            return (
              <DerivedField
                key={index}
                value={field}
                onChange={newField => {
                  const newDerivedFields = [...value];
                  newDerivedFields.splice(index, 1, newField);
                  onChange(newDerivedFields);
                }}
                onDelete={() => {
                  const newDerivedFields = [...value];
                  newDerivedFields.splice(index, 1);
                  onChange(newDerivedFields);
                }}
                suggestions={[
                  {
                    value: `${DataLinkBuiltInVars.valueText}`,
                    label: 'Text',
                    documentation: 'Text representation of selected value',
                    origin: VariableOrigin.Value,
                  },
                ]}
              />
            );
          })}
        <div>
          <Button
            variant={'secondary'}
            onClick={event => {
              event.preventDefault();
              const newDerivedFields = [...(value || []), { name: '', matcherRegex: '' }];
              onChange(newDerivedFields);
            }}
          >
            Add
          </Button>
        </div>
      </div>
    </>
  );
};

type DerivedFieldProps = {
  value: DerivedFieldConfig;
  onChange: (value: DerivedFieldConfig) => void;
  onDelete: () => void;
  suggestions: VariableSuggestion[];
};
const DerivedField = (props: DerivedFieldProps) => {
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

        <Button
          variant={'danger'}
          onClick={event => {
            event.preventDefault();
            onDelete();
          }}
        >
          Delete
        </Button>
      </div>

      <FormField
        label="Regex"
        type="text"
        value={value.matcherRegex}
        onChange={handleChange('matcherRegex')}
        tooltip={
          'Use to parse and capture some part of the log message. You can use the captured groups in the template.'
        }
      />

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

type DebugSectionProps = {
  derivedFields: DerivedFieldConfig[];
  className?: string;
};
const DebugSection = (props: DebugSectionProps) => {
  const { derivedFields, className } = props;
  const [debugText, setDebugText] = useState('');

  let results: any[] = [];

  if (debugText) {
    results = derivedFields.reduce((acc, field) => {
      if (field.name && field.matcherRegex) {
        try {
          const testMatch = debugText.match(field.matcherRegex);

          acc.push({
            name: field.name,
            result: (testMatch && testMatch[1]) || '<no match>',
          });
          return acc;
        } catch (error) {
          acc.push({
            label: field.name,
            error,
          });
          return acc;
        }
      }
      return acc;
    }, []);
  }

  return (
    <div className={className}>
      <FormField
        labelWidth={12}
        label={'Debug input'}
        inputEl={
          <textarea
            className={cx(
              'gf-form-textarea',
              css`
                width: 100%;
              `
            )}
            value={debugText}
            onChange={event => setDebugText(event.currentTarget.value)}
          />
        }
      />
      {!!results.length &&
        results.map(result => {
          return (
            <div>
              {result.name} = {result.result || '<no match>'}
            </div>
          );
        })}
    </div>
  );
};
