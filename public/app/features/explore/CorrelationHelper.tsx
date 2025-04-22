import { css } from '@emotion/css';
import { useState, useEffect, useId } from 'react';
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
  Stack,
} from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
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
  const { value: defaultLabel, loading: loadingLabel } = useAsync(
    async () => await generateDefaultLabel(panesVals[0]!, panesVals[1]!),
    [
      panesVals[0]?.datasourceInstance,
      panesVals[0]?.queries[0].datasource,
      panesVals[1]?.datasourceInstance,
      panesVals[1]?.queries[0].datasource,
    ]
  );

  const { register, watch, getValues, setValue } = useForm<FormValues>();
  const [isLabelDescOpen, setIsLabelDescOpen] = useState(false);
  const [isTransformOpen, setIsTransformOpen] = useState(false);
  const [showTransformationAddModal, setShowTransformationAddModal] = useState(false);
  const [transformations, setTransformations] = useState<DataLinkTransformationConfig[]>([]);
  const [transformationIdxToEdit, setTransformationIdxToEdit] = useState<number | undefined>(undefined);
  const correlationDetails = useSelector(selectCorrelationDetails);
  const id = useId();

  // only fire once on mount to allow save button to enable / disable when unmounted
  useEffect(() => {
    dispatch(changeCorrelationEditorDetails({ canSave: true }));
    return () => {
      dispatch(changeCorrelationEditorDetails({ canSave: false }));
    };
  }, [dispatch]);

  useEffect(() => {
    if (
      !loadingLabel &&
      defaultLabel !== undefined &&
      !correlationDetails?.correlationDirty &&
      getValues('label') !== ''
    ) {
      setValue('label', defaultLabel);
    }
  }, [correlationDetails?.correlationDirty, defaultLabel, getValues, loadingLabel, setValue]);

  useEffect(() => {
    const subscription = watch((value) => {
      let dirty = correlationDetails?.correlationDirty || false;
      let description = value.description || '';
      if (!dirty && (value.label !== defaultLabel || description !== '')) {
        dirty = true;
      } else if (dirty && value.label === defaultLabel && description.trim() === '') {
        dirty = false;
      }
      dispatch(
        changeCorrelationEditorDetails({ label: value.label, description: value.description, correlationDirty: dirty })
      );
    });
    return () => subscription.unsubscribe();
  }, [correlationDetails?.correlationDirty, defaultLabel, dispatch, watch]);

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
          fieldList={correlations.origVars}
          transformationToEdit={
            transformationIdxToEdit !== undefined ? transformations[transformationIdxToEdit] : undefined
          }
        />
      )}
      <Alert title={t('explore.correlation-helper.title-correlation-details', 'Correlation details')} severity="info">
        <Trans
          i18nKey="explore.correlation-helper.body-correlation-details"
          values={{ resultField: correlations.resultField }}
        >
          The correlation link will appear by the <code>{'{{resultField}}'}</code> field. You can use the following
          variables to set up your correlations:
        </Trans>
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
            <Stack gap={1} direction="row" wrap="wrap" alignItems="center">
              <Trans i18nKey="explore.correlation-helper.label-description-header">Label / Description</Trans>
              {!isLabelDescOpen && !loadingLabel && (
                <span className={styles.labelCollapseDetails}>{`Label: ${getValues('label') || defaultLabel}`}</span>
              )}
            </Stack>
          }
        >
          <Field label={t('explore.correlation-helper.label-label', 'Label')} htmlFor={`${id}-label`}>
            <Input
              {...register('label')}
              id={`${id}-label`}
              onBlur={() => {
                if (getValues('label') === '' && defaultLabel !== undefined) {
                  setValue('label', defaultLabel);
                }
              }}
            />
          </Field>
          <Field label={t('explore.correlation-helper.label-description', 'Description')} htmlFor={`${id}-description`}>
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
            <Stack gap={1} direction="row" wrap="wrap" alignItems="center">
              <Trans i18nKey="explore.correlation-helper.transformations">Transformations</Trans>
              <Tooltip
                content={t(
                  'explore.correlation-helper.tooltip-transformations',
                  'A transformation extracts one or more variables out of a single field.'
                )}
              >
                <Icon name="info-circle" size="sm" />
              </Tooltip>
            </Stack>
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
            <Trans i18nKey="explore.correlation-helper.add-transformation">Add transformation</Trans>
          </Button>
          {transformations.map((transformation, i) => {
            const { type, field, expression, mapValue } = transformation;
            const detailsString = [
              (mapValue ?? '').length > 0 ? `Variable name: ${mapValue}` : undefined,
              (expression ?? '').length > 0 ? (
                <Trans i18nKey="explore.correlation-helper.expression" values={{ expression }}>
                  Expression: <code>{'{{expression}}'}</code>
                </Trans>
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
                    aria-label={t('explore.correlation-helper.aria-label-edit-transformation', 'Edit transformation')}
                    onClick={() => {
                      setTransformationIdxToEdit(i);
                      setShowTransformationAddModal(true);
                    }}
                  />
                  <DeleteButton
                    aria-label={t(
                      'explore.correlation-helper.aria-label-delete-transformation',
                      'Delete transformation'
                    )}
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
