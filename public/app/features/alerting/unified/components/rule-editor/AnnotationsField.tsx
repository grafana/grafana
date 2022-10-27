import { css, cx } from '@emotion/css';
import { debounce } from 'lodash';
import React, { CSSProperties, useCallback, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { useDebounce, useToggle } from 'react-use';
import { FixedSizeList } from 'react-window';

import { GrafanaTheme, GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import {
  Button,
  Field,
  FilterInput,
  Input,
  InputControl,
  Label,
  LoadingPlaceholder,
  Modal,
  TextArea,
  useStyles,
  useStyles2,
} from '@grafana/ui';

import { dashboardApi } from '../../api/alertingApi';
import { RuleFormValues } from '../../types/rule-form';

import { AnnotationKeyInput } from './AnnotationKeyInput';

const AnnotationsField = () => {
  const styles = useStyles(getStyles);
  const [showPanelSelector, setShowPanelSelector] = useToggle(false);

  const {
    control,
    register,
    watch,
    formState: { errors },
  } = useFormContext<RuleFormValues>();
  const annotations = watch('annotations');

  const existingKeys = useCallback(
    (index: number): string[] => annotations.filter((_, idx: number) => idx !== index).map(({ key }) => key),
    [annotations]
  );

  const { fields, append, remove } = useFieldArray({ control, name: 'annotations' });

  return (
    <>
      <Label>Summary and annotations</Label>
      <div className={styles.flexColumn}>
        {fields.map((annotationField, index) => {
          const isUrl = annotations[index]?.key?.toLocaleLowerCase().endsWith('url');
          const ValueInputComponent = isUrl ? Input : TextArea;

          return (
            <div key={annotationField.id} className={styles.flexRow}>
              <Field
                className={styles.field}
                invalid={!!errors.annotations?.[index]?.key?.message}
                error={errors.annotations?.[index]?.key?.message}
                data-testid={`annotation-key-${index}`}
              >
                <InputControl
                  name={`annotations.${index}.key`}
                  defaultValue={annotationField.key}
                  render={({ field: { ref, ...field } }) => (
                    <AnnotationKeyInput
                      {...field}
                      aria-label={`Annotation detail ${index + 1}`}
                      existingKeys={existingKeys(index)}
                      width={18}
                    />
                  )}
                  control={control}
                  rules={{ required: { value: !!annotations[index]?.value, message: 'Required.' } }}
                />
              </Field>
              <Field
                className={cx(styles.flexRowItemMargin, styles.field)}
                invalid={!!errors.annotations?.[index]?.value?.message}
                error={errors.annotations?.[index]?.value?.message}
              >
                <ValueInputComponent
                  data-testid={`annotation-value-${index}`}
                  className={cx(styles.annotationValueInput, { [styles.textarea]: !isUrl })}
                  {...register(`annotations.${index}.value`)}
                  placeholder={isUrl ? 'https://' : `Text`}
                  defaultValue={annotationField.value}
                />
              </Field>
              <Button
                type="button"
                className={styles.flexRowItemMargin}
                aria-label="delete annotation"
                icon="trash-alt"
                variant="secondary"
                onClick={() => remove(index)}
              />
            </div>
          );
        })}
        <Button
          className={styles.addAnnotationsButton}
          icon="plus-circle"
          type="button"
          variant="secondary"
          onClick={() => {
            append({ key: '', value: '' });
          }}
        >
          Add info
        </Button>
        <Button type="button" variant="secondary" onClick={setShowPanelSelector}>
          Set panel and dashboard
        </Button>
        <Modal
          title="Select dashboard and panel"
          closeOnEscape
          isOpen={showPanelSelector}
          onDismiss={setShowPanelSelector}
        >
          DASHBOARD AND PANEL PICKER
          <DashboardPicker />
        </Modal>
      </div>
    </>
  );
};

const DashboardPicker = () => {
  const styles = useStyles2(getPickerStyles);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const { useSearchQuery, useLazyDashboardQuery } = dashboardApi;

  const { data: searchResults } = useSearchQuery({ query: debouncedQuery });
  const [triggerDashboard, dashboardResult] = useLazyDashboardQuery();

  useDebounce(
    () => {
      setDebouncedQuery(query);
    },
    500,
    [query]
  );

  if (!searchResults) {
    return null;
  }

  const DashboardRow = ({ index, style }: { index: number; style: CSSProperties }) => {
    const dashboard = searchResults[index];

    return (
      <div style={style} className={styles.row} onClick={() => triggerDashboard({ uid: dashboard.uid })}>
        {dashboard.title}
      </div>
    );
  };

  return (
    <Stack direction="row">
      <div style={{ flex: 1 }}>
        <FilterInput value={query} onChange={setQuery} title="Search dashboard" />
        <FixedSizeList itemSize={40} height={600} itemCount={searchResults.length} width="100%">
          {DashboardRow}
        </FixedSizeList>
      </div>
      <div style={{ flex: 1 }}>
        {dashboardResult?.currentData && (
          <ul>
            {dashboardResult?.currentData?.dashboard?.panels?.map((panel) => (
              <li key={panel.id}>{panel.title}</li>
            ))}
          </ul>
        )}
        {dashboardResult.isLoading && <LoadingPlaceholder text="Loading dashboard" />}
      </div>
    </Stack>
  );
};

const getPickerStyles = (theme: GrafanaTheme2) => ({
  row: css`
    padding: ${theme.spacing(1)};
  `,
});

const getStyles = (theme: GrafanaTheme) => ({
  annotationValueInput: css`
    width: 426px;
  `,
  textarea: css`
    height: 76px;
  `,
  addAnnotationsButton: css`
    flex-grow: 0;
    align-self: flex-start;
    margin-left: 148px;
  `,
  flexColumn: css`
    display: flex;
    flex-direction: column;
  `,
  field: css`
    margin-bottom: ${theme.spacing.xs};
  `,
  flexRow: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
  `,
  flexRowItemMargin: css`
    margin-left: ${theme.spacing.xs};
  `,
});

export default AnnotationsField;
