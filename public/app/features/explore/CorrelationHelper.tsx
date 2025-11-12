import { css } from '@emotion/css';
import { useEffect, useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useAsync } from 'react-use';

import { DataLinkTransformationConfig, ExploreCorrelationHelperData, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Button,
  Card,
  Collapse,
  DeleteButton,
  Field,
  Icon,
  IconButton,
  Input,
  Select,
  Stack,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

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
  type: string;
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

  const { control, register, watch, getValues, setValue } = useForm<FormValues>({
    defaultValues: {
      type: 'Link',
    },
  });
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
      <Alert
        className={styles.alertWrapper}
        title={t('explore.correlation-helper.title-correlation-details', 'Correlation details')}
        severity="info"
      >
        <div className={styles.alertContent}>
          <div>
            {/* <Trans
              i18nKey="explore.correlation-helper.body-correlation-details"
              values={{ resultField: correlations.resultField }}
            > */}
            <p>
              When saved, the <code>{correlations.resultField}</code> field will have a clickable link that runs your target
              query below.
            </p>
            {/* </Trans> */}
          </div>
        </div>
        </Alert>
            <Stack gap={1} direction="row" wrap="wrap" alignItems="center">
              <p>General</p>
            </Stack>
          <Field label="Type" htmlFor={`${id}-type`}>
            <Controller
              name="type"
              control={control}
              render={({ field: { onChange, value, ...field } }) => {
                const typeOptions: Array<SelectableValue<string>> = [
                  { label: 'Link', value: 'Link' },
                  { label: 'Explore Query', value: 'Explore Query' },
                ];
                return (
                  <Select
                    {...field}
                    inputId={`${id}-type`}
                    options={typeOptions}
                    value={typeOptions.find((option) => option.value === value) || typeOptions[0]}
                    onChange={(option) => onChange(option?.value || 'Link')}
                  />
                );
              }}
            />
          </Field>
          <Field label="Name" htmlFor={`${id}-label`}>
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
          <Field label="Description" htmlFor={`${id}-description`}>
            <Input {...register('description')} id={`${id}-description`} />
          </Field>
            <Stack gap={1} direction="row" wrap="wrap" alignItems="center">
              {/* <Trans i18nKey="explore.correlation-helper.transformations">Transformations</Trans> */}
              Variables (optional)
              <Tooltip
                content={t(
                  'explore.correlation-helper.tooltip-transformations',
                  'A transformation extracts one or more variables out of a single field.'
                )}
              >
                <Icon name="info-circle" size="sm" />
              </Tooltip>
            </Stack>
          <p>Use these variables in your target query. When a correlation link is clicked, each variable is filled in with its value from that row.</p>          
          <div className={styles.variableList}>        

            {Object.entries(correlations.vars).map(([name, value]) => (
              <div key={name} className={styles.variableRow}>
                <div className={styles.variableNameCell}>
                  <code className={styles.variableName}>${`{${name}}`}</code>
                </div>
                <div className={styles.variableValueCell}>
                  <Tooltip content={value} placement="auto-start">
                    <span className={styles.variableValue}>{value}</span>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>     

          <Button
            variant="secondary"
            fill="outline"
            onClick={() => {
              setShowTransformationAddModal(true);
            }}
            className={styles.transformationAction}
          >
            {/* <Trans i18nKey="explore.correlation-helper.add-transformation">Add transformation</Trans> */}
            Add custom variable
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
              <Card noMargin key={`trans-${i}`}>
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
        <hr />
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
    alertWrapper: css({
      '& > div': {
        minWidth: 0,
        maxWidth: '100%',
        overflow: 'hidden',
      },
    }),
    alertContent: css({
      minWidth: 0,
      maxWidth: '100%',
      overflow: 'hidden',
      width: '100%',
    }),
    variableList: css({
      marginTop: theme.spacing(1.5),
      marginBottom: theme.spacing(2),
      display: 'table',
      width: '100%',
      tableLayout: 'auto',
      borderCollapse: 'collapse',
    }),
    variableRow: css({
      display: 'table-row',
    }),
    variableNameCell: css({
      display: 'table-cell',
      width: '1%',
      paddingBottom: theme.spacing(0.5),
      paddingRight: theme.spacing(1),
      verticalAlign: 'top',
      whiteSpace: 'nowrap',
    }),
    variableName: css({
      display: 'inline-block',
      backgroundColor: theme.colors.background.secondary,
      padding: theme.spacing(0.5, 1),
      borderRadius: theme.shape.radius.default,
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.primary.text,
      fontWeight: theme.typography.fontWeightMedium,
      whiteSpace: 'nowrap',
    }),
    variableValueCell: css({
      display: 'table-cell',
      width: '100%',
      maxWidth: 0,
      paddingBottom: theme.spacing(0.5),
      verticalAlign: 'top',
    }),
    variableValue: css({
      display: 'inline-block',
      backgroundColor: theme.colors.background.secondary,
      padding: theme.spacing(0.5, 1),
      borderRadius: theme.shape.radius.default,
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.primary,
      maxWidth: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      verticalAlign: 'top',
    }),
  };
};
