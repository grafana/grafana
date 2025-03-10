import { css } from '@emotion/css';
import { useRef } from 'react';
import { Controller } from 'react-hook-form';
import { useAsyncFn, useClickAway } from 'react-use';

import { AnnotationEventUIModel, GrafanaTheme2, dateTimeFormat, systemDateFormats } from '@grafana/data';
import { Button, Field, Stack, TextArea, usePanelContext, useStyles2 } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { getAnnotationTags } from 'app/features/annotations/api';

interface Props {
  annoVals: Record<string, any[]>;
  annoIdx: number;
  timeZone: string;
  dismiss: () => void;
}

interface AnnotationEditFormDTO {
  description: string;
  tags: string[];
}

export const AnnotationEditor2 = ({ annoVals, annoIdx, dismiss, timeZone, ...otherProps }: Props) => {
  const styles = useStyles2(getStyles);
  const { onAnnotationCreate, onAnnotationUpdate } = usePanelContext();

  const clickAwayRef = useRef(null);

  useClickAway(clickAwayRef, dismiss);

  const [createAnnotationState, createAnnotation] = useAsyncFn(async (event: AnnotationEventUIModel) => {
    const result = await onAnnotationCreate!(event);
    dismiss();
    return result;
  });

  const [updateAnnotationState, updateAnnotation] = useAsyncFn(async (event: AnnotationEventUIModel) => {
    const result = await onAnnotationUpdate!(event);
    dismiss();
    return result;
  });

  const timeFormatter = (value: number) =>
    dateTimeFormat(value, {
      format: systemDateFormats.fullDate,
      timeZone,
    });

  const isUpdatingAnnotation = annoVals.id?.[annoIdx] != null;
  const isRegionAnnotation = annoVals.isRegion?.[annoIdx];
  const operation = isUpdatingAnnotation ? updateAnnotation : createAnnotation;
  const stateIndicator = isUpdatingAnnotation ? updateAnnotationState : createAnnotationState;
  const time = isRegionAnnotation
    ? `${timeFormatter(annoVals.time[annoIdx])} - ${timeFormatter(annoVals.timeEnd[annoIdx])}`
    : timeFormatter(annoVals.time[annoIdx]);

  const onSubmit = ({ tags, description }: AnnotationEditFormDTO) => {
    operation({
      id: annoVals.id?.[annoIdx] ?? undefined,
      tags,
      description,
      from: Math.round(annoVals.time[annoIdx]!),
      to: Math.round(annoVals.timeEnd?.[annoIdx] ?? annoVals.time[annoIdx]!),
    });
  };

  // Annotation editor
  return (
    <div ref={clickAwayRef} className={styles.editor} {...otherProps}>
      <div className={styles.header}>
        <Stack justifyContent={'space-between'} alignItems={'center'}>
          <div>{isUpdatingAnnotation ? 'Edit annotation' : 'Add annotation'}</div>
          <div>{time}</div>
        </Stack>
      </div>
      <Form<AnnotationEditFormDTO>
        onSubmit={onSubmit}
        defaultValues={{ description: annoVals.text?.[annoIdx], tags: annoVals.tags?.[annoIdx] || [] }}
      >
        {({ register, errors, control }) => {
          return (
            <>
              <div className={styles.content}>
                <Field label={'Description'} invalid={!!errors.description} error={errors?.description?.message}>
                  <TextArea
                    className={styles.textarea}
                    {...register('description', {
                      required: 'Annotation description is required',
                    })}
                  />
                </Field>
                <Field label={'Tags'}>
                  <Controller
                    control={control}
                    name="tags"
                    render={({ field: { ref, onChange, ...field } }) => {
                      return (
                        <TagFilter
                          allowCustomValue
                          placeholder="Add tags"
                          onChange={onChange}
                          tagOptions={getAnnotationTags}
                          tags={field.value}
                        />
                      );
                    }}
                  />
                </Field>
              </div>
              <div className={styles.footer}>
                <Stack justifyContent={'flex-end'}>
                  <Button size={'sm'} variant="secondary" onClick={dismiss} fill="outline">
                    Cancel
                  </Button>
                  <Button size={'sm'} type={'submit'} disabled={stateIndicator?.loading}>
                    {stateIndicator?.loading ? 'Saving' : 'Save'}
                  </Button>
                </Stack>
              </div>
            </>
          );
        }}
      </Form>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    editor: css({
      background: theme.colors.background.elevated,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      userSelect: 'text',
      width: '460px',
    }),
    content: css({
      padding: theme.spacing(1),
    }),
    header: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(0.5, 1),
      fontWeight: theme.typography.fontWeightBold,
      fontSize: theme.typography.fontSize,
      color: theme.colors.text.primary,
    }),
    footer: css({
      borderTop: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(1, 1),
    }),
    textarea: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
};
