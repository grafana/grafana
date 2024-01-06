import { css } from '@emotion/css';
import React from 'react';
import { useAsyncFn } from 'react-use';

import { AnnotationEventUIModel, GrafanaTheme2 } from '@grafana/data';
import { Button, Field, Form, HorizontalGroup, InputControl, TextArea, usePanelContext, useStyles2 } from '@grafana/ui';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { getAnnotationTags } from 'app/features/annotations/api';

interface Props {
  annoVals: Record<string, any[]>;
  annoIdx: number;
  timeFormatter: (v: number) => string;
  onSave: () => void;
  onDismiss: () => void;
}

interface AnnotationEditFormDTO {
  description: string;
  tags: string[];
}

export const AnnotationEditor2 = ({ annoVals, annoIdx, onSave, onDismiss, timeFormatter, ...otherProps }: Props) => {
  const styles = useStyles2(getStyles);
  const panelContext = usePanelContext();

  const [createAnnotationState, createAnnotation] = useAsyncFn(async (event: AnnotationEventUIModel) => {
    const result = await panelContext.onAnnotationCreate!(event);
    if (onSave) {
      onSave();
    }
    return result;
  });

  const [updateAnnotationState, updateAnnotation] = useAsyncFn(async (event: AnnotationEventUIModel) => {
    const result = await panelContext.onAnnotationUpdate!(event);
    if (onSave) {
      onSave();
    }
    return result;
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
    <div className={styles.editor} {...otherProps}>
      <div className={styles.header}>
        <HorizontalGroup justify={'space-between'} align={'center'}>
          <div>{isUpdatingAnnotation ? 'Edit annotation' : 'Add annotation'}</div>
          <div>{time}</div>
        </HorizontalGroup>
      </div>
      <div className={styles.editorForm}>
        <Form<AnnotationEditFormDTO>
          onSubmit={onSubmit}
          defaultValues={{ description: annoVals.text[annoIdx], tags: annoVals.tags[annoIdx] || [] }}
        >
          {({ register, errors, control }) => {
            return (
              <>
                <Field label={'Description'} invalid={!!errors.description} error={errors?.description?.message}>
                  <TextArea
                    {...register('description', {
                      required: 'Annotation description is required',
                    })}
                  />
                </Field>
                <Field label={'Tags'}>
                  <InputControl
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
                <HorizontalGroup justify={'flex-end'}>
                  <Button size={'sm'} variant="secondary" onClick={onDismiss} fill="outline">
                    Cancel
                  </Button>
                  <Button size={'sm'} type={'submit'} disabled={stateIndicator?.loading}>
                    {stateIndicator?.loading ? 'Saving' : 'Save'}
                  </Button>
                </HorizontalGroup>
              </>
            );
          }}
        </Form>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    editor: css({
      // zIndex: theme.zIndex.tooltip,
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      userSelect: 'text',
      width: '460px',
    }),
    editorForm: css({
      padding: theme.spacing(1),
    }),
    header: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(0.5, 1),
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
  };
};
