import React, { FC } from 'react';
import {
  InputControl,
  FieldSet,
  Field,
  Label,
  Select,
  TextArea,
  stylesFactory,
  Button,
  FormAPI,
  FieldArray,
  IconButton,
} from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { config } from 'app/core/config';
import { css, cx } from 'emotion';
import LabelsField from './LabelsField';

interface Props extends FormAPI<{}> {}

enum AnnotationOptions {
  summary = 'Summary',
  description = 'Description',
  runbook = 'Runbook url',
}

const AlertDetails: FC<Props> = ({ control, register }) => {
  const styles = getStyles(config.theme);
  const annotationOptions = Object.entries(AnnotationOptions).map(([key, value]) => ({ value: key, label: value }));
  return (
    <FieldSet label="Add details for your alert">
      <Label>Summary and annotations</Label>
      <FieldArray name={'annotations'} control={control}>
        {({ fields, append, remove }) => {
          return (
            <div className={styles.flexColumn}>
              {fields.map((field, index) => {
                return (
                  <div key={`${field.annotationKey}-${index}`} className={styles.flexRow}>
                    <Field className={styles.annotationSelect}>
                      <InputControl
                        as={Select}
                        name={`annotations[${index}].key`}
                        options={annotationOptions}
                        control={control}
                        defaultValue={field.key}
                      />
                    </Field>
                    <Field className={cx(styles.annotationTextArea, styles.flexRowItemMargin)}>
                      <TextArea
                        name={`annotations[${index}].value`}
                        ref={register()}
                        placeholder={`Text`}
                        defaultValue={field.value}
                      />
                    </Field>
                    <IconButton
                      className={styles.flexRowItemMargin}
                      aria-label="delete annotation"
                      name="trash-alt"
                      onClick={() => {
                        remove(index);
                      }}
                    />
                  </div>
                );
              })}
              <Button
                className={styles.addAnnotationsButton}
                icon="plus-circle"
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  append({});
                }}
              >
                Add info
              </Button>
            </div>
          );
        }}
      </FieldArray>
      <LabelsField {...{ control, register }} />
    </FieldSet>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    annotationSelect: css`
      width: 120px;
    `,
    annotationTextArea: css`
      width: 450px;
      height: 76px;
    `,
    addAnnotationsButton: css`
      flex-grow: 0;
      align-self: flex-start;
    `,
    flexColumn: css`
      display: flex;
      flex-direction: column;
    `,
    flexRow: css`
      display: flex;
      flex-direction: row;
      justify-content: flex-start;
    `,
    flexRowItemMargin: css`
      margin-left: ${theme.spacing.sm};
    `,
  };
});

export default AlertDetails;
