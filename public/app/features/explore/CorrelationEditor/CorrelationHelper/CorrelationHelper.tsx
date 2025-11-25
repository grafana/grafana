import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useAsync } from 'react-use';

import { DataLinkTransformationConfig, GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types/store';

import { getTransformationVars } from '../../../correlations/transformations';
import { generateDefaultLabel } from '../../../correlations/utils';
import { changeCorrelationHelperData } from '../../state/explorePane';
import { changeCorrelationEditorDetails } from '../../state/main';
import { selectCorrelationDetails, selectPanes } from '../../state/selectors';
import { CorrelationTransformationAddModal } from '../CorrelationTransformationAddModal';
import { CorrelationHelperProps, CorrelationType, FormValues, TransformationHandlers } from '../types';

import { CorrelationFormCustomVariables } from './CorrelationFormCustomVariables';
import { CorrelationFormInformation } from './CorrelationFormInformation';

export const CorrelationHelper = ({ exploreId, correlations }: CorrelationHelperProps) => {
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
    defaultValues: { type: CorrelationType.ExploreQuery },
  });

  const selectedType = useWatch({ control, name: 'type' });

  const [showTransformationAddModal, setShowTransformationAddModal] = useState(false);
  const [transformations, setTransformations] = useState<DataLinkTransformationConfig[]>([]);
  const [transformationIdxToEdit, setTransformationIdxToEdit] = useState<number | undefined>(undefined);
  const correlationDetails = useSelector(selectCorrelationDetails);

  const transformationHandlers: TransformationHandlers = {
    onEdit: (index: number) => {
      setTransformationIdxToEdit(index);
      setShowTransformationAddModal(true);
    },
    onDelete: (index: number) => {
      setTransformations((prev) => prev.filter((_, idx) => idx !== index));
    },
    onAdd: () => {
      setShowTransformationAddModal(true);
    },
    onModalCancel: () => {
      setTransformationIdxToEdit(undefined);
      setShowTransformationAddModal(false);
    },
    onModalSave: (transformation: DataLinkTransformationConfig) => {
      if (transformationIdxToEdit !== undefined) {
        const editTransformations = [...transformations];
        editTransformations[transformationIdxToEdit] = transformation;
        setTransformations(editTransformations);
        setTransformationIdxToEdit(undefined);
      } else {
        setTransformations([...transformations, transformation]);
      }
      setShowTransformationAddModal(false);
    },
  };

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
      <Stack direction="column" gap={1.5}>
        <div className={styles.infoBox}>
          <Stack direction="row" gap={1} alignItems="flex-start">
            <Icon name="info-circle" size="sm" className={styles.infoIcon} />
            <Text variant="body" color="secondary">
              {selectedType === CorrelationType.Link ? (
                <Trans
                  i18nKey="explore.correlation-helper.body-correlation-details-link"
                  values={{ resultField: correlations.resultField }}
                >
                  When saved, the <code>{'{{resultField}}'}</code> field will have a clickable link that opens the
                  specified URL.
                </Trans>
              ) : (
                <Trans
                  i18nKey="explore.correlation-helper.body-correlation-details-query"
                  values={{ resultField: correlations.resultField }}
                >
                  When saved, the <code>{'{{resultField}}'}</code> field will have a clickable link that runs your
                  target query below.
                </Trans>
              )}
            </Text>
          </Stack>
        </div>
        <CorrelationFormInformation
          control={control}
          register={register}
          getValues={getValues}
          setValue={setValue}
          defaultLabel={defaultLabel}
          selectedType={selectedType}
        />
        {selectedType === CorrelationType.ExploreQuery && (
          <CorrelationFormCustomVariables
            correlations={correlations}
            transformations={transformations}
            handlers={transformationHandlers}
          />
        )}
      </Stack>

      <div className={styles.divider} />
      {showTransformationAddModal && selectedType === CorrelationType.ExploreQuery && (
        <CorrelationTransformationAddModal
          onCancel={transformationHandlers.onModalCancel}
          onSave={transformationHandlers.onModalSave}
          fieldList={correlations.origVars}
          transformationToEdit={
            transformationIdxToEdit !== undefined ? transformations[transformationIdxToEdit] : undefined
          }
        />
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  infoBox: css({
    padding: theme.spacing(1.5),
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  infoIcon: css({
    color: theme.colors.info.text,
    marginTop: theme.spacing(0.25),
  }),
  divider: css({
    height: '1px',
    backgroundColor: theme.colors.border.weak,
    margin: theme.spacing(2, 0),
  }),
});
