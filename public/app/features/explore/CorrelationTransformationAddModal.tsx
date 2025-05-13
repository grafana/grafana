import { css } from '@emotion/css';
import { useId, useState, useMemo, useEffect } from 'react';
import Highlighter from 'react-highlight-words';
import { useForm, Controller } from 'react-hook-form';

import { DataLinkTransformationConfig, ScopedVars } from '@grafana/data';
import { Button, Field, Icon, Input, Label, Modal, Select, Tooltip, Stack } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import {
  getSupportedTransTypeDetails,
  getTransformOptions,
  TransformationFieldDetails,
} from '../correlations/Forms/types';
import { getTransformationVars } from '../correlations/transformations';

interface CorrelationTransformationAddModalProps {
  onCancel: () => void;
  onSave: (transformation: DataLinkTransformationConfig) => void;
  fieldList: Record<string, string>;
  transformationToEdit?: DataLinkTransformationConfig;
}

interface ShowFormFields {
  expressionDetails: TransformationFieldDetails;
  mapValueDetails: TransformationFieldDetails;
}

const LabelWithTooltip = ({ label, tooltipText }: { label: string; tooltipText: string }) => (
  <Stack gap={1} direction="row" wrap="wrap" alignItems="flex-start">
    <Label>{label}</Label>
    <Tooltip content={tooltipText}>
      <Icon name="info-circle" size="sm" />
    </Tooltip>
  </Stack>
);

export const CorrelationTransformationAddModal = ({
  onSave,
  onCancel,
  fieldList,
  transformationToEdit,
}: CorrelationTransformationAddModalProps) => {
  const [exampleValue, setExampleValue] = useState<string | undefined>(undefined);
  const [transformationVars, setTransformationVars] = useState<ScopedVars>({});
  const [formFieldsVis, setFormFieldsVis] = useState<ShowFormFields>({
    mapValueDetails: { show: false },
    expressionDetails: { show: false },
  });
  const [isExpValid, setIsExpValid] = useState(false); // keep the highlighter from erroring on bad expressions
  const [validToSave, setValidToSave] = useState(false);
  const { getValues, control, register, watch } = useForm<DataLinkTransformationConfig>({
    defaultValues: useMemo(() => {
      if (transformationToEdit) {
        const exampleVal = fieldList[transformationToEdit?.field!];
        setExampleValue(exampleVal);
        if (transformationToEdit?.expression) {
          setIsExpValid(true);
        }
        const transformationTypeDetails = getSupportedTransTypeDetails(transformationToEdit?.type!);
        setFormFieldsVis({
          mapValueDetails: transformationTypeDetails.mapValueDetails,
          expressionDetails: transformationTypeDetails.expressionDetails,
        });

        const transformationVars = getTransformationVars(
          {
            type: transformationToEdit?.type!,
            expression: transformationToEdit?.expression,
            mapValue: transformationToEdit?.mapValue,
          },
          exampleVal || '',
          transformationToEdit?.field!
        );
        setTransformationVars({ ...transformationVars });
        setValidToSave(true);
        return {
          type: transformationToEdit?.type,
          field: transformationToEdit?.field,
          mapValue: transformationToEdit?.mapValue,
          expression: transformationToEdit?.expression,
        };
      } else {
        return undefined;
      }
    }, [fieldList, transformationToEdit]),
  });
  const id = useId();

  useEffect(() => {
    const subscription = watch((formValues) => {
      const expression = formValues.expression;
      let isExpressionValid = false;
      if (expression !== undefined) {
        isExpressionValid = true;
        try {
          new RegExp(expression);
        } catch (e) {
          isExpressionValid = false;
        }
      } else {
        isExpressionValid = !formFieldsVis.expressionDetails.show;
      }
      setIsExpValid(isExpressionValid);
      let transKeys = [];
      if (formValues.type) {
        const transformationVars = getTransformationVars(
          {
            type: formValues.type,
            expression: isExpressionValid ? expression : '',
            mapValue: formValues.mapValue,
          },
          fieldList[formValues.field!] || '',
          formValues.field!
        );

        transKeys = Object.keys(transformationVars);
        setTransformationVars(transKeys.length > 0 ? { ...transformationVars } : {});
      }

      if (transKeys.length === 0 || !isExpressionValid) {
        setValidToSave(false);
      } else {
        setValidToSave(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [fieldList, formFieldsVis.expressionDetails.show, watch]);

  return (
    <Modal
      isOpen={true}
      title={
        transformationToEdit
          ? t('explore.correlation-transformation-add-modal.title-edit', 'Edit transformation')
          : t('explore.correlation-transformation-add-modal.title-add', 'Add transformation')
      }
      onDismiss={onCancel}
      className={css({ width: '700px' })}
    >
      <p>
        <Trans i18nKey="explore.correlation-transformation-add-modal.body">
          A transformation extracts variables out of a single field. These variables will be available along with your
          field variables.
        </Trans>
      </p>
      <Field label={t('explore.correlation-transformation-add-modal.label-field', 'Field')}>
        <Controller
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
              aria-label={t('explore.correlation-transformation-add-modal.aria-label-field', 'Field')}
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
              searchWords={[isExpValid ? (getValues('expression') ?? '') : '']}
              autoEscape={false}
            />
          </pre>
          <Field label={t('explore.correlation-transformation-add-modal.label-type', 'Type')}>
            <Controller
              control={control}
              render={({ field: { onChange, ref, ...field } }) => (
                <Select
                  {...field}
                  onChange={(value) => {
                    onChange(value.value);
                    const transformationTypeDetails = getSupportedTransTypeDetails(value.value!);
                    setFormFieldsVis({
                      mapValueDetails: transformationTypeDetails.mapValueDetails,
                      expressionDetails: transformationTypeDetails.expressionDetails,
                    });
                  }}
                  options={getTransformOptions()}
                  aria-label={t('explore.correlation-transformation-add-modal.aria-label-type', 'Type')}
                />
              )}
              name={`type` as const}
            />
          </Field>
          {formFieldsVis.expressionDetails.show && (
            <Field
              label={
                formFieldsVis.expressionDetails.helpText ? (
                  <LabelWithTooltip
                    label={t('explore.correlation-transformation-add-modal.label-expression', 'Expression')}
                    tooltipText={formFieldsVis.expressionDetails.helpText}
                  />
                ) : (
                  t('explore.correlation-transformation-add-modal.label-expression-without-tooltip', 'Expression')
                )
              }
              htmlFor={`${id}-expression`}
              required={formFieldsVis.expressionDetails.required}
            >
              <Input {...register('expression')} id={`${id}-expression`} />
            </Field>
          )}
          {formFieldsVis.mapValueDetails.show && (
            <Field
              label={
                formFieldsVis.mapValueDetails.helpText ? (
                  <LabelWithTooltip
                    label={t('explore.correlation-transformation-add-modal.label-variable-name', 'Variable name')}
                    tooltipText={formFieldsVis.mapValueDetails.helpText}
                  />
                ) : (
                  t('explore.correlation-transformation-add-modal.label-variable-name-without-tooltip', 'Variable name')
                )
              }
              htmlFor={`${id}-mapValue`}
            >
              <Input {...register('mapValue')} id={`${id}-mapValue`} />
            </Field>
          )}
          {Object.entries(transformationVars).length > 0 && (
            <>
              <Trans i18nKey="explore.correlation-transformation-add-modal.added-variables">
                This transformation will add the following variables:
              </Trans>
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
          <Trans i18nKey="explore.correlation-transformation-add-modal.cancel">Cancel</Trans>
        </Button>
        <Button variant="primary" onClick={() => onSave(getValues())} disabled={!validToSave}>
          {transformationToEdit
            ? t('explore.correlation-transformation-add-modal.edit-transformation', 'Edit transformation')
            : t('explore.correlation-transformation-add-modal.add-transformation', 'Add transformation to correlation')}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
