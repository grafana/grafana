import { css, cx } from '@emotion/css';
import React, { HTMLAttributes, useRef } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import useClickAway from 'react-use/lib/useClickAway';

import { AnnotationEventUIModel, GrafanaTheme2 } from '@grafana/data';
import { Button, Field, Form, HorizontalGroup, InputControl, TextArea, usePanelContext, useStyles2 } from '@grafana/ui';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { getAnnotationTags } from 'app/features/annotations/api';

import { AnnotationsDataFrameViewDTO } from '../types';

interface AnnotationEditFormDTO {
  description: string;
  tags: string[];
}

interface AnnotationEditorFormProps extends HTMLAttributes<HTMLDivElement> {
  annotation: AnnotationsDataFrameViewDTO;
  timeFormatter: (v: number) => string;
  onSave: () => void;
  onDismiss: () => void;
}

export const AnnotationEditorForm = React.forwardRef<HTMLDivElement, AnnotationEditorFormProps>(
  ({ annotation, onSave, onDismiss, timeFormatter, className, ...otherProps }, ref) => {
    const styles = useStyles2(getStyles);
    const panelContext = usePanelContext();
    const clickAwayRef = useRef(null);

    useClickAway(clickAwayRef, () => {
      onDismiss();
    });

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

    const isUpdatingAnnotation = annotation.id !== undefined;
    const isRegionAnnotation = annotation.time !== annotation.timeEnd;
    const operation = isUpdatingAnnotation ? updateAnnotation : createAnnotation;
    const stateIndicator = isUpdatingAnnotation ? updateAnnotationState : createAnnotationState;
    const ts = isRegionAnnotation
      ? `${timeFormatter(annotation.time)} - ${timeFormatter(annotation.timeEnd)}`
      : timeFormatter(annotation.time);

    const onSubmit = ({ tags, description }: AnnotationEditFormDTO) => {
      operation({
        id: annotation.id,
        tags,
        description,
        from: Math.round(annotation.time!),
        to: Math.round(annotation.timeEnd!),
      });
    };

    const form = (
      <div // Annotation editor
        ref={ref}
        className={cx(styles.editor, className)}
        {...otherProps}
      >
        <div className={styles.header}>
          <HorizontalGroup justify={'space-between'} align={'center'}>
            <div className={styles.title}>Add annotation</div>
            <div className={styles.ts}>{ts}</div>
          </HorizontalGroup>
        </div>
        <div className={styles.editorForm}>
          <Form<AnnotationEditFormDTO>
            onSubmit={onSubmit}
            defaultValues={{ description: annotation?.text, tags: annotation?.tags || [] }}
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

    return (
      <>
        <div className={styles.backdrop} />
        <div ref={clickAwayRef}>{form}</div>
      </>
    );
  }
);

AnnotationEditorForm.displayName = 'AnnotationEditorForm';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    backdrop: css`
      label: backdrop;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      z-index: ${theme.zIndex.navbarFixed};
    `,
    editorContainer: css`
      position: absolute;
      top: calc(100% + 10px);
      transform: translate3d(-50%, 0, 0);
    `,
    editor: css`
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
      z-index: ${theme.zIndex.dropdown};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.borderRadius()};
      width: 460px;
    `,
    editorForm: css`
      padding: ${theme.spacing(1)};
    `,
    header: css`
      border-bottom: 1px solid ${theme.colors.border.weak};
      padding: ${theme.spacing(1.5, 1)};
    `,
    title: css`
      font-weight: ${theme.typography.fontWeightMedium};
    `,
    ts: css`
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
    `,
  };
};
