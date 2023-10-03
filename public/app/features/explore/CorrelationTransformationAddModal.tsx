import { css } from '@emotion/css';
import React, { useId, useState } from 'react';
import Highlighter from 'react-highlight-words';
import { useForm } from 'react-hook-form';

import { DataLinkTransformationConfig, ScopedVars, SupportedTransformationType } from '@grafana/data';
import { Button, Field, Input, InputControl, Modal, Select } from '@grafana/ui';

import { getSupportedTransTypeDetails, getTransformOptions } from '../correlations/Forms/types';
import { getTransformationVars } from '../correlations/transformations';

interface CorrelationTransformationAddModalProps {
  onCancel: () => void;
  onSave: () => void;
  fieldList: Record<string, string>;
}

interface ShowFormFields {
  showMapValue: boolean;
  showExpression: boolean;
}

export const CorrelationTransformationAddModal = ({
  onSave,
  onCancel,
  fieldList,
}: CorrelationTransformationAddModalProps) => {
  const { getValues, control, register } = useForm<DataLinkTransformationConfig>();
  const [exampleValue, setExampleValue] = useState<string | undefined>(undefined);
  const [transformationVars, setTransformationVars] = useState<ScopedVars>();
  const [formFieldsVis, setFormFieldsVis] = useState<ShowFormFields>({ showMapValue: false, showExpression: false });
  const id = useId();

  const calcTransformationVars = () => {
    setTransformationVars(undefined);

    const transformationVars = getTransformationVars(
      {
        type: getValues('type') as SupportedTransformationType,
        expression: getValues('expression'),
        mapValue: getValues('mapValue'),
      },
      exampleValue || '',
      getValues('field')!
    );

    if (Object.keys(transformationVars).length > 0) {
      setTransformationVars({ ...transformationVars });
    }
  };

  return (
    <Modal isOpen={true} title="Add transformation" onDismiss={onCancel} className={css({ width: '700px' })}>
      <p>
        A transformation extracts variables out of a single field. These variables will be available along with your
        field variables.
      </p>
      <Field label="Field" htmlFor={`${id}-field`}>
        <Select
          id={`${id}-field`}
          options={Object.entries(fieldList).map((entry) => {
            return { label: entry[0], value: entry[0] };
          })}
          onChange={(value) => {
            if (value.value) {
              setExampleValue(fieldList[value.value]);
            }
          }}
        />
      </Field>
      {exampleValue && (
        <>
          <pre>
            <Highlighter
              textToHighlight={exampleValue}
              searchWords={[getValues('expression') ?? '']}
              autoEscape={false}
            />
          </pre>
          <Field label="Type">
            <InputControl
              control={control}
              render={({ field: { onChange, ref, ...field } }) => (
                <Select
                  {...field}
                  onChange={(value) => {
                    onChange(value.value);
                    const transformationTypeDetails = getSupportedTransTypeDetails(
                      value.value as SupportedTransformationType
                    );
                    setFormFieldsVis({
                      showMapValue: transformationTypeDetails.showMapValue,
                      showExpression: transformationTypeDetails.showExpression,
                    });
                    calcTransformationVars(); // not all transformation types require more input
                  }}
                  options={getTransformOptions()}
                  aria-label="type"
                />
              )}
              name={`type` as const}
            />
          </Field>
          {formFieldsVis.showExpression && (
            <Field label="Expression" htmlFor={`${id}-expression`} required>
              <Input {...register('expression')} id={`${id}-expression`} onKeyUp={calcTransformationVars} />
            </Field>
          )}
          {formFieldsVis.showMapValue && (
            <Field label="Map Value" htmlFor={`${id}-mapValue`}>
              <Input {...register('mapValue')} id={`${id}-mapValue`} onKeyUp={calcTransformationVars} />
            </Field>
          )}
          {transformationVars !== undefined && (
            <>
              This transformation will add the following variables:
              <pre>
                {Object.entries(transformationVars).map((entry) => {
                  return `\$\{${entry[0]}\} = ${entry[1]?.value}\n`;
                })}
              </pre>
            </>
          )}
        </>
      )}
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onCancel} fill="outline">
          Cancel
        </Button>
        <Button variant="primary" onClick={onSave}>
          Save transformation
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
