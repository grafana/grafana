import { css } from '@emotion/css';
import React, { useId, useState } from 'react';
import Highlighter from 'react-highlight-words';
import { useForm } from 'react-hook-form';

import { DataLinkTransformationConfig, ScopedVars, SupportedTransformationType } from '@grafana/data';
import { Button, Field, Icon, Input, InputControl, Label, Modal, Select, Tooltip } from '@grafana/ui';
import { Flex } from '@grafana/ui/src/unstable';

import { getSupportedTransTypeDetails, getTransformOptions } from '../correlations/Forms/types';
import { getTransformationVars } from '../correlations/transformations';

interface CorrelationTransformationAddModalProps {
  onCancel: () => void;
  onSave: (transformation: DataLinkTransformationConfig) => void;
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
  const [isExpValid, setIsExpValid] = useState(false); // keep the highlighter from erroring on bad expressions
  const [validToSave, setValidToSave] = useState(false);
  const id = useId();

  const calcTransformationVars = () => {
    setTransformationVars(undefined);

    const expression = getValues('expression');
    let isExpressionValid = false;
    if (expression !== undefined) {
      isExpressionValid = true;
      try {
        new RegExp(expression);
      } catch (e) {
        isExpressionValid = false;
      }
    } else {
      isExpressionValid = !formFieldsVis.showExpression;
    }
    setIsExpValid(isExpressionValid);

    const transformationVars = getTransformationVars(
      {
        type: getValues('type'),
        expression: isExpressionValid ? expression : '',
        mapValue: getValues('mapValue'),
      },
      exampleValue || '',
      getValues('field')!
    );

    const transKeys = Object.keys(transformationVars);
    if (transKeys.length > 0) {
      setTransformationVars({ ...transformationVars });
    }

    if (transKeys.length === 0 || !isExpressionValid) {
      setValidToSave(false);
    } else {
      setValidToSave(true);
    }
  };

  return (
    <Modal isOpen={true} title="Add transformation" onDismiss={onCancel} className={css({ width: '700px' })}>
      <p>
        A transformation extracts variables out of a single field. These variables will be available along with your
        field variables.
      </p>
      <Field label="Field">
        <InputControl
          control={control}
          render={({ field: { onChange, ref, ...field } }) => (
            <Select
              {...field}
              onChange={(value) => {
                if (value.value) {
                  onChange(value.value);
                  setExampleValue(fieldList[value.value]);
                }
              }}
              options={Object.entries(fieldList).map((entry) => {
                return { label: entry[0], value: entry[0] };
              })}
              aria-label="field"
            />
          )}
          name={`field` as const}
        />
      </Field>

      {exampleValue && (
        <>
          <pre>
            <Highlighter
              textToHighlight={exampleValue}
              searchWords={[isExpValid ? getValues('expression') ?? '' : '']}
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
            <Field
              label={
                <Flex gap={1} direction="row" wrap="wrap" alignItems="baseline">
                  <Label>Variable Name</Label>
                  <Tooltip content="The name of the variable that will be used, if a name is not defined in the expression. It will overwrite the field variable if one is ultimately not defined.">
                    <Icon name="info-circle" size="sm" />
                  </Tooltip>
                </Flex>
              }
              htmlFor={`${id}-mapValue`}
            >
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
        <Button variant="primary" onClick={() => onSave(getValues())} disabled={!validToSave}>
          Add transformation to correlation
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
