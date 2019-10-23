import React, { useState } from 'react';
import {
  Button,
  DataSourceHttpSettings,
  DataSourcePluginOptionsEditorProps,
  DataSourceSettings,
  FormField,
  Input,
  Modal,
} from '@grafana/ui';
import { DerivedFieldConfig, LokiOptions } from '../types';

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
  const [showAddDerivedField, setShowAddDerivedField] = useState(false);
  const [derivedFieldEditIndex, setDerivedFieldEditIndex] = useState<number | undefined>(undefined);

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

      <h3 className="page-heading">Derived fields</h3>

      <table className="filter-table form-inline filter-table--hover">
        <thead>
          <tr>
            <th>Label</th>
            <th>Regex</th>
            <th>Template</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {options.jsonData.derivedFields &&
            options.jsonData.derivedFields.map((field, index) => {
              return (
                <tr key={index}>
                  <td>{field.label}</td>
                  <td>{field.matcherRegex}</td>
                  <td>{field.template}</td>
                  <td>
                    <Button
                      variant={'danger'}
                      onClick={event => {
                        event.preventDefault();
                        const newDerivedFields = [...options.jsonData.derivedFields];
                        newDerivedFields.splice(index, 1);
                        onOptionsChange(setDerivedFields(options, newDerivedFields));
                      }}
                    >
                      Delete
                    </Button>

                    <Button
                      variant={'secondary'}
                      onClick={event => {
                        event.preventDefault();
                        setDerivedFieldEditIndex(index);
                        setShowAddDerivedField(true);
                      }}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>

      <Button
        variant={'secondary'}
        onClick={event => {
          event.preventDefault();
          setShowAddDerivedField(true);
        }}
      >
        Add
      </Button>
      <DerivedFieldModal
        key={derivedFieldEditIndex}
        initialData={
          derivedFieldEditIndex !== undefined ? options.jsonData.derivedFields[derivedFieldEditIndex] : undefined
        }
        isOpen={showAddDerivedField}
        onDismiss={() => {
          setShowAddDerivedField(false);
          setDerivedFieldEditIndex(undefined);
        }}
        onSave={data => {
          let newDerivedFields;
          if (derivedFieldEditIndex === undefined) {
            newDerivedFields = [...options.jsonData.derivedFields, data];
          } else {
            newDerivedFields = [...options.jsonData.derivedFields];
            newDerivedFields.splice(derivedFieldEditIndex, 1, data);
            setDerivedFieldEditIndex(undefined);
          }
          onOptionsChange(setDerivedFields(options, newDerivedFields));
          setShowAddDerivedField(false);
        }}
      />

      {/*<div className="gf-form-group">*/}
      {/*  <div className="gf-form-inline">*/}
      {/*    <div className="gf-form">*/}
      {/*      {options.jsonData.derivedFields &&*/}
      {/*        options.jsonData.derivedFields.map((field, index) => {*/}
      {/*          return (*/}
      {/*            <DerivedField*/}
      {/*              key={index}*/}
      {/*              value={field}*/}
      {/*              onChange={newField => {*/}
      {/*                const newDerivedFields = [...options.jsonData.derivedFields];*/}
      {/*                newDerivedFields.splice(index, 1, newField);*/}
      {/*                onOptionsChange(setDerivedFields(options, newDerivedFields));*/}
      {/*              }}*/}
      {/*            />*/}
      {/*          );*/}
      {/*        })}*/}
      {/*      <div>*/}
      {/*        <Button*/}
      {/*          variant={'secondary'}*/}
      {/*          onClick={event => {*/}
      {/*            event.preventDefault();*/}
      {/*            const newDerivedFields = [*/}
      {/*              ...(options.jsonData.derivedFields || []),*/}
      {/*              { label: '', matcherRegex: '', template: '' },*/}
      {/*            ];*/}
      {/*            console.log({ newDerivedFields });*/}
      {/*            console.log(setDerivedFields(options, newDerivedFields));*/}
      {/*            onOptionsChange(setDerivedFields(options, newDerivedFields));*/}
      {/*          }}*/}
      {/*        >*/}
      {/*          Add*/}
      {/*        </Button>*/}
      {/*      </div>*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*</div>*/}
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

type DerivedFieldModalProps = {
  isOpen: boolean;
  onDismiss: () => void;
  onSave: (value: DerivedFieldConfig) => void;
  initialData?: DerivedFieldConfig;
};
const DerivedFieldModal = (props: DerivedFieldModalProps) => {
  const { isOpen, onSave, onDismiss, initialData } = props;
  const [label, setLabel] = useState(initialData ? initialData.label : '');
  const [regex, setRegex] = useState(initialData ? initialData.matcherRegex : '');
  const [template, setTemplate] = useState(initialData ? initialData.template : '');
  const [test, setTest] = useState('');

  let showTest = false;
  let testError = null;
  let testResult = '';
  if (regex && template && test) {
    showTest = true;
    try {
      const testMatch = test.match(regex);
      if (testMatch) {
        testResult = template.replace(/\$(\d)+/, (match, p1) => {
          return testMatch[parseInt(p1, 10) + 1];
        });
      }
    } catch (e) {
      testError = e;
    }
  }

  return (
    <Modal title={'Add derived field'} isOpen={isOpen} onDismiss={onDismiss}>
      <FormField
        label="Label"
        inputEl={<Input type="text" value={label} onChange={event => setLabel(event.currentTarget.value)} />}
      />

      <FormField
        label="Regex"
        inputEl={<Input type="text" value={regex} onChange={event => setRegex(event.currentTarget.value)} />}
        tooltip={
          'Use to parse and capture some part of the log message. You can use the captured groups in the template.'
        }
      />

      <FormField
        label="Template"
        inputEl={<Input type="text" value={template} onChange={event => setTemplate(event.currentTarget.value)} />}
      />

      <div>
        <textarea style={{ width: '100%' }} value={test} onChange={event => setTest(event.currentTarget.value)} />
        {showTest && (
          <div>
            {testError}
            {testResult}
          </div>
        )}
      </div>

      <Button
        variant={'secondary'}
        onClick={event => {
          event.preventDefault();
          onSave({
            label,
            matcherRegex: regex,
            template,
          });
        }}
      >
        Save
      </Button>
    </Modal>
  );
};

type DerivedFieldProps = {
  value: DerivedFieldConfig;
  onChange: (value: DerivedFieldConfig) => void;
};
const DerivedField = (props: DerivedFieldProps) => {
  const { value, onChange } = props;
  return (
    <>
      <FormField
        label="Label"
        inputEl={
          <Input
            type="text"
            value={value.label}
            onChange={event =>
              onChange({
                ...value,
                label: event.currentTarget.value,
              })
            }
          />
        }
      />

      <FormField
        label="Regex"
        inputEl={
          <Input
            type="text"
            value={value.matcherRegex}
            onChange={event =>
              onChange({
                ...value,
                matcherRegex: event.currentTarget.value,
              })
            }
          />
        }
        tooltip={
          'Use to parse and capture some part of the log message. You can use the captured groups in the template.'
        }
      />

      <FormField
        label="Template"
        inputEl={
          <Input
            type="text"
            value={value.template}
            onChange={event =>
              onChange({
                ...value,
                template: event.currentTarget.value,
              })
            }
          />
        }
      />
    </>
  );
};
