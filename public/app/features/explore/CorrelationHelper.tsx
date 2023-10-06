import { css } from '@emotion/css';
import React, { useState, useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';

import { DataLinkTransformationConfig, ExploreCorrelationHelperData, GrafanaTheme2 } from '@grafana/data';
import { Collapse, Alert, Field, Input, Button, Card, IconButton, useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types';

import { getTransformationVars } from '../correlations/transformations';

import { CorrelationTransformationAddModal } from './CorrelationTransformationAddModal';
import { changeCorrelationEditorDetails } from './state/main';
import { selectCorrelationDetails } from './state/selectors';

interface Props {
  correlations: ExploreCorrelationHelperData;
}

interface FormValues {
  label: string;
  description: string;
}

export const CorrelationHelper = ({ correlations }: Props) => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);
  const { register, watch } = useForm<FormValues>();
  const [correlationVars, setCorrelationVars] = useState(correlations.vars);
  const [isLabelDescOpen, setIsLabelDescOpen] = useState(false);
  const [isTransformOpen, setIsTransformOpen] = useState(false);
  const [showTransformationAddModal, setShowTransformationAddModal] = useState(false);
  const [transformations, setTransformations] = useState<DataLinkTransformationConfig[]>([]);
  const [transformationIdxToEdit, setTransformationIdxToEdit] = useState<number | undefined>(undefined);
  const correlationDetails = useSelector(selectCorrelationDetails);
  const id = useId();

  useEffect(() => {
    const subscription = watch((value) => {
      let dirty = false;

      if (!correlationDetails?.dirty && (value.label !== '' || value.description !== '')) {
        dirty = true;
      } else if (correlationDetails?.dirty && value.label.trim() === '' && value.description.trim() === '') {
        dirty = false;
      }
      dispatch(changeCorrelationEditorDetails({ label: value.label, description: value.description, dirty: dirty }));
    });
    return () => subscription.unsubscribe();
  }, [correlationDetails?.dirty, dispatch, watch]);

  // only fire once on mount to allow save button to enable / disable when unmounted
  useEffect(() => {
    dispatch(changeCorrelationEditorDetails({ canSave: true }));

    return () => {
      dispatch(changeCorrelationEditorDetails({ canSave: false }));
    };
  }, [dispatch]);

  useEffect(() => {
    const dirty = !correlationDetails?.dirty && transformations.length > 0 ? true : correlationDetails?.dirty;
    dispatch(changeCorrelationEditorDetails({ transformations: transformations, dirty: dirty }));
    let transVarRecords: Record<string, string> = {};
    transformations.forEach((transformation) => {
      const transformationVars = getTransformationVars(
        {
          type: transformation.type,
          expression: transformation.expression,
          mapValue: transformation.mapValue,
        },
        correlations.vars[transformation.field!],
        transformation.field!
      );

      Object.keys(transformationVars).forEach((key) => {
        transVarRecords[key] = transformationVars[key]?.value;
      });
    });
    setCorrelationVars({ ...correlations.vars, ...transVarRecords });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, transformations]);

  return (
    <>
      {showTransformationAddModal && (
        <CorrelationTransformationAddModal
          onCancel={() => {
            setTransformationIdxToEdit(undefined);
            setShowTransformationAddModal(false);
          }}
          onSave={(transformation: DataLinkTransformationConfig) => {
            if (transformationIdxToEdit !== undefined) {
              const editTransformations = [...transformations];
              editTransformations[transformationIdxToEdit] = transformation;
              setTransformations(editTransformations);
              setTransformationIdxToEdit(undefined);
            } else {
              setTransformations([...transformations, transformation]);
            }
            setShowTransformationAddModal(false);
          }}
          fieldList={correlations.vars}
          transformationToEdit={
            transformationIdxToEdit !== undefined ? transformations[transformationIdxToEdit] : undefined
          }
        />
      )}
      <Alert title="Correlation details" severity="info">
        The correlation link will appear by the <code>{correlations.resultField}</code> field. You can use the following
        variables to set up your correlations:
        <pre>
          {Object.entries(correlationVars).map((entry) => {
            return `\$\{${entry[0]}\} = ${entry[1]}\n`;
          })}
        </pre>
        <Collapse
          collapsible
          isOpen={isLabelDescOpen}
          onToggle={() => {
            setIsLabelDescOpen(!isLabelDescOpen);
          }}
          label="Label/Description"
        >
          <Field label="Label" htmlFor={`${id}-label`}>
            <Input {...register('label')} id={`${id}-label`} />
          </Field>
          <Field label="Description" htmlFor={`${id}-description`}>
            <Input {...register('description')} id={`${id}-description`} />
          </Field>
        </Collapse>
        <Collapse
          collapsible
          isOpen={isTransformOpen}
          onToggle={() => {
            setIsTransformOpen(!isTransformOpen);
          }}
          label="Transformations"
        >
          <Button
            variant="secondary"
            fill="outline"
            onClick={() => {
              setShowTransformationAddModal(true);
            }}
            className={styles.transformationAction}
          >
            Add transformation
          </Button>
          {transformations.map((transformation, i) => {
            const { type, field, expression, mapValue } = transformation;
            const detailsString = [
              (mapValue ?? '').length > 0 ? `Variable name: ${mapValue}` : undefined,
              (expression ?? '').length > 0 ? (
                <>
                  Expression: <code>{expression}</code>
                </>
              ) : undefined,
            ].filter((val) => val);
            return (
              <Card key={`trans-${i}`}>
                <Card.Heading>
                  {field}: {type}
                </Card.Heading>
                {detailsString.length > 0 && (
                  <Card.Meta className={styles.transformationMeta}>{detailsString}</Card.Meta>
                )}
                <Card.SecondaryActions>
                  <IconButton
                    key="edit"
                    name="edit"
                    aria-label="edit transformation"
                    onClick={() => {
                      setTransformationIdxToEdit(i);
                      setShowTransformationAddModal(true);
                    }}
                  />
                  <IconButton
                    key="delete"
                    name="trash-alt"
                    aria-label="delete transformation"
                    onClick={() => {
                      setTransformations(transformations.filter((_, idx) => i !== idx));
                    }}
                  />
                </Card.SecondaryActions>
              </Card>
            );
          })}
        </Collapse>
      </Alert>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    transformationAction: css({
      marginBottom: theme.spacing(2),
    }),
    transformationMeta: css({
      alignItems: 'baseline',
    }),
  };
};
