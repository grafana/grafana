import { css } from '@emotion/css';
import React, { useState, useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';
import { useAsync } from 'react-use';

import { DataLinkTransformationConfig, ExploreCorrelationHelperData, GrafanaTheme2 } from '@grafana/data';
import {
  Collapse,
  Alert,
  Field,
  Input,
  Button,
  Card,
  IconButton,
  useStyles2,
  DeleteButton,
  Tooltip,
  Icon,
} from '@grafana/ui';
import { Flex } from '@grafana/ui/src/unstable';
import { useDispatch, useSelector } from 'app/types';

import { getTransformationVars } from '../correlations/transformations';
import { generateDefaultLabel } from '../correlations/utils';

import { CorrelationTransformationAddModal } from './CorrelationTransformationAddModal';
import { changeCorrelationHelperData } from './state/explorePane';
import { changeCorrelationEditorDetails } from './state/main';
import { selectCorrelationDetails, selectPanes } from './state/selectors';

interface Props {
  exploreId: string;
  correlations: ExploreCorrelationHelperData;
}

interface FormValues {
  label: string;
  description: string;
}

export const CorrelationHelper = ({ exploreId, correlations }: Props) => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);
  const panes = useSelector(selectPanes);
  const panesVals = Object.values(panes);
  const { value: defaultLabel } = useAsync(async () => await generateDefaultLabel(panesVals[0]!, panesVals[1]!), []);

  const {
    register,
    watch,
    getValues,
    formState: { isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      label: defaultLabel,
      description: '',
    },
  });
  const [isLabelDescOpen, setIsLabelDescOpen] = useState(false);
  const [isTransformOpen, setIsTransformOpen] = useState(false);
  const [showTransformationAddModal, setShowTransformationAddModal] = useState(false);
  const [transformations, setTransformations] = useState<DataLinkTransformationConfig[]>([]);
  const [transformationIdxToEdit, setTransformationIdxToEdit] = useState<number | undefined>(undefined);
  const correlationDetails = useSelector(selectCorrelationDetails);
  const id = useId();
  useEffect(() => {
    const subscription = watch((value) => {
      dispatch(
        changeCorrelationEditorDetails({
          label: value.label,
          description: value.description,
          correlationDirty: isDirty,
        })
      );
    });
    return () => subscription.unsubscribe();
  }, [dispatch, isDirty, watch]);

  // only fire once on mount to allow save button to enable / disable when unmounted
  useEffect(() => {
    dispatch(changeCorrelationEditorDetails({ canSave: true }));

    return () => {
      dispatch(changeCorrelationEditorDetails({ canSave: false }));
    };
  }, [dispatch]);

  useEffect(() => {
    const dirty =
      !correlationDetails?.correlationDirty && transformations.length > 0 ? true : correlationDetails?.correlationDirty;
    dispatch(changeCorrelationEditorDetails({ transformations: transformations, correlationDirty: dirty }));
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

    dispatch(
      changeCorrelationHelperData({
        exploreId: exploreId,
        correlationEditorHelperData: {
          resultField: correlations.resultField,
          origVars: correlations.origVars,
          vars: { ...correlations.origVars, ...transVarRecords },
        },
      })
    );
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
          {Object.entries(correlations.vars).map((entry) => {
            return `\$\{${entry[0]}\} = ${entry[1]}\n`;
          })}
        </pre>
        <Collapse
          collapsible
          isOpen={isLabelDescOpen}
          onToggle={() => {
            setIsLabelDescOpen(!isLabelDescOpen);
          }}
          label={
            <Flex gap={1} direction="row" wrap="wrap" alignItems="baseline">
              Label / Description
              {!isLabelDescOpen && (
                <span className={styles.labelCollapseDetails}>{`Label: ${getValues('label')}`}</span>
              )}
            </Flex>
          }
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
          label={
            <Flex gap={1} direction="row" wrap="wrap" alignItems="baseline">
              Transformations
              <Tooltip content="A transformation extracts one or more variables out of a single field.">
                <Icon name="info-circle" size="sm" />
              </Tooltip>
            </Flex>
          }
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
                  <DeleteButton
                    aria-label="delete transformation"
                    onConfirm={() => setTransformations(transformations.filter((_, idx) => i !== idx))}
                    closeOnConfirm
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
    labelCollapseDetails: css({
      marginLeft: theme.spacing(2),
      ...theme.typography['bodySmall'],
      fontStyle: 'italic',
    }),
    transformationAction: css({
      marginBottom: theme.spacing(2),
    }),
    transformationMeta: css({
      alignItems: 'baseline',
    }),
  };
};
