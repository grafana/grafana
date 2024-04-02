import { css, cx } from '@emotion/css';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Field, InlineLabel, Input, LoadingPlaceholder, Stack, Text, useStyles2 } from '@grafana/ui';
import { useDispatch } from 'app/types';

import { labelsApi } from '../../../api/labelsApi';
import { usePluginBridge } from '../../../hooks/usePluginBridge';
import { useUnifiedAlertingSelector } from '../../../hooks/useUnifiedAlertingSelector';
import { fetchRulerRulesIfNotFetchedYet } from '../../../state/actions';
import { SupportedPlugin } from '../../../types/pluginBridges';
import { RuleFormValues } from '../../../types/rule-form';
import AlertLabelDropdown from '../../AlertLabelDropdown';
import { AlertLabels } from '../../AlertLabels';
import { NeedHelpInfo } from '../NeedHelpInfo';

import { AddButton, RemoveButton } from './LabelsButtons';

const useGetOpsLabelsKeys = (skip: boolean) => {
  const { currentData, isLoading: isloadingLabels } = labelsApi.endpoints.getLabels.useQuery(undefined, {
    skip,
  });
  return { loading: isloadingLabels, labelsOpsKeys: currentData };
};
const useGetCustomLabels = (dataSourceName: string): { loading: boolean; labelsByKey: Record<string, Set<string>> } => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchRulerRulesIfNotFetchedYet(dataSourceName));
  }, [dispatch, dataSourceName]);

  const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
  const rulerRequest = rulerRuleRequests[dataSourceName];

  const labelsByKeyResult = useMemo<Record<string, Set<string>>>(() => {
    const labelsByKey: Record<string, Set<string>> = {};

    const rulerRulesConfig = rulerRequest?.result;
    if (!rulerRulesConfig) {
      return labelsByKey;
    }

    const allRules = Object.values(rulerRulesConfig)
      .flatMap((groups) => groups)
      .flatMap((group) => group.rules);

    allRules.forEach((rule) => {
      if (rule.labels) {
        Object.entries(rule.labels).forEach(([key, value]) => {
          if (!value) {
            return;
          }

          const labelEntry = labelsByKey[key];
          if (labelEntry) {
            labelEntry.add(value);
          } else {
            labelsByKey[key] = new Set([value]);
          }
        });
      }
    });

    return labelsByKey;
  }, [rulerRequest]);

  return { loading: rulerRequest?.loading, labelsByKey: labelsByKeyResult };
};

function mapLabelsToOptions(items: Iterable<string> = []): Array<SelectableValue<string>> {
  return Array.from(items, (item) => ({ label: item, value: item }));
}

export const LabelsInRule = () => {
  const { watch } = useFormContext<RuleFormValues>();
  const labels = watch('labels');

  const labelsObj: Record<string, string> = labels.reduce((acc: Record<string, string>, label) => {
    if (label.key) {
      acc[label.key] = label.value;
    }
    return acc;
  }, {});

  return <AlertLabels labels={labelsObj} />;
};
/*
  We will suggest labels from two sources: existing alerts and ops labels.
  We only will suggest labels from ops if the grafana-labels-app plugin is installed
  */
export const LabelsWithSuggestions: FC<{ dataSourceName: string }> = ({ dataSourceName }) => {
  const styles = useStyles2(getStyles);
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  const labels = watch('labels');
  const { fields, remove, append } = useFieldArray({ control, name: 'labels' });

  // check if the labels plugin is installed
  const { installed: labelsPluginInstalled = false, loading: loadingLabelsPlugin } = usePluginBridge(
    SupportedPlugin.Labels
  );
  const [selectedKey, setSelectedKey] = useState('');

  // ------- Get labels keys and their values from existing alerts
  const { loading, labelsByKey: labelsByKeyFromExisingAlerts } = useGetCustomLabels(dataSourceName);
  // ------- Get only the keys from the ops labels, as we will fetch the values for the keys once the key is selected.
  const { loading: isLoadingLabels, labelsOpsKeys = [] } = useGetOpsLabelsKeys(
    !labelsPluginInstalled || loadingLabelsPlugin
  );
  //------ Convert the labelsOpsKeys to the same format as the labelsByKeyFromExisingAlerts
  const labelsByKeyOps = useMemo(() => {
    return labelsOpsKeys.reduce((acc: Record<string, Set<string>>, label) => {
      acc[label.name] = new Set();
      return acc;
    }, {});
  }, [labelsOpsKeys]);

  //------- Convert the keys from the ops labels to options for the dropdown
  const keysFromGopsLabels = useMemo(() => {
    return mapLabelsToOptions(Object.keys(labelsByKeyOps));
  }, [labelsByKeyOps]);

  //------- Convert the keys from the existing alerts to options for the dropdown
  const keysFromExistingAlerts = useMemo(() => {
    return mapLabelsToOptions(Object.keys(labelsByKeyFromExisingAlerts));
  }, [labelsByKeyFromExisingAlerts]);

  // create two groups of labels, one for ops and one for custom
  const groupedOptions = [
    {
      label: 'From alerts',
      options: keysFromExistingAlerts,
    },
    {
      label: 'From system',
      options: keysFromGopsLabels,
    },
  ];

  const selectedKeyIsFromAlerts =
    labelsByKeyFromExisingAlerts[selectedKey] !== undefined && labelsByKeyFromExisingAlerts[selectedKey]?.size > 0;
  const valuesAlreadyFetched = !selectedKeyIsFromAlerts && labelsByKeyOps[selectedKey]?.size > 0;

  // Only fetch the values for the selected key if it is from ops and the values are not already fetched (the selected key is not in the labelsByKeyOps object)
  const {
    currentData: valuesData,
    isLoading: isLoadingValues = false,
    error,
  } = labelsApi.endpoints.getLabelValues.useQuery(
    { key: selectedKey },
    {
      skip: !labelsPluginInstalled || !selectedKey || selectedKeyIsFromAlerts || valuesAlreadyFetched,
    }
  );

  // these are the values for the selected key in case it is from ops
  const valuesFromSelectedGopsKey = useMemo(() => {
    // if it is from alerts, we need to fetch the values from the existing alerts
    if (selectedKeyIsFromAlerts) {
      return [];
    }
    // in case of a label from ops, we need to fetch the values from the plugin
    // fetch values from ops only if there is no value for the key
    const valuesForSelectedKey = labelsByKeyOps[selectedKey];
    const valuesAlreadyFetched = valuesForSelectedKey?.size > 0;
    if (valuesAlreadyFetched) {
      return mapLabelsToOptions(valuesForSelectedKey);
    }
    if (!isLoadingValues && valuesData?.values?.length && !error) {
      const values = valuesData?.values.map((value) => value.name);
      labelsByKeyOps[selectedKey] = new Set(values);
      return mapLabelsToOptions(values);
    }
    return [];
  }, [selectedKeyIsFromAlerts, labelsByKeyOps, selectedKey, isLoadingValues, valuesData, error]);

  const getValuesForLabel = useCallback(
    (key: string) => {
      // values from existing alerts will take precedence over values from ops
      if (selectedKeyIsFromAlerts || !labelsPluginInstalled) {
        return mapLabelsToOptions(labelsByKeyFromExisingAlerts[key]);
      }
      return valuesFromSelectedGopsKey;
    },
    [labelsByKeyFromExisingAlerts, labelsPluginInstalled, valuesFromSelectedGopsKey, selectedKeyIsFromAlerts]
  );

  const values = useMemo(() => {
    return getValuesForLabel(selectedKey);
  }, [selectedKey, getValuesForLabel]);

  const isLoading = isLoadingLabels || loading || loadingLabelsPlugin;

  return (
    <>
      {isLoading && <LoadingPlaceholder text="Loading existing labels" />}
      {!isLoading && (
        <Stack direction="column" gap={0.5}>
          {fields.map((field, index) => {
            return (
              <div key={field.id}>
                <div className={cx(styles.flexRow, styles.centerAlignRow)}>
                  <Field
                    className={styles.labelInput}
                    invalid={Boolean(errors.labels?.[index]?.key?.message)}
                    error={errors.labels?.[index]?.key?.message}
                    data-testid={`label-key-${index}`}
                  >
                    <Controller
                      name={`labels.${index}.key`}
                      control={control}
                      rules={{ required: Boolean(labels[index]?.value) ? 'Required.' : false }}
                      render={({ field: { onChange, ref, ...rest } }) => {
                        return (
                          <AlertLabelDropdown
                            {...rest}
                            defaultValue={field.key ? { label: field.key, value: field.key } : undefined}
                            options={labelsPluginInstalled ? groupedOptions : keysFromExistingAlerts}
                            onChange={(newValue: SelectableValue) => {
                              onChange(newValue.value);
                              setSelectedKey(newValue.value);
                            }}
                            type="key"
                          />
                        );
                      }}
                    />
                  </Field>
                  <InlineLabel className={styles.equalSign}>=</InlineLabel>
                  <Field
                    className={styles.labelInput}
                    invalid={Boolean(errors.labels?.[index]?.value?.message)}
                    error={errors.labels?.[index]?.value?.message}
                    data-testid={`label-value-${index}`}
                  >
                    <Controller
                      control={control}
                      name={`labels.${index}.value`}
                      rules={{ required: Boolean(labels[index]?.value) ? 'Required.' : false }}
                      render={({ field: { onChange, ref, ...rest } }) => {
                        return (
                          <AlertLabelDropdown
                            {...rest}
                            defaultValue={field.value ? { label: field.value, value: field.value } : undefined}
                            options={values}
                            onChange={(newValue: SelectableValue) => {
                              onChange(newValue.value);
                            }}
                            onOpenMenu={() => {
                              setSelectedKey(labels[index].key);
                            }}
                            type="value"
                          />
                        );
                      }}
                    />
                  </Field>

                  <RemoveButton className={styles.deleteLabelButton} index={index} remove={remove} />
                </div>
              </div>
            );
          })}
          <AddButton className={styles.addLabelButton} append={append} />
        </Stack>
      )}
    </>
  );
};

export const LabelsWithoutSuggestions: FC = () => {
  const styles = useStyles2(getStyles);
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  const labels = watch('labels');
  const { fields, remove, append } = useFieldArray({ control, name: 'labels' });

  return (
    <>
      {fields.map((field, index) => {
        return (
          <div key={field.id}>
            <div className={cx(styles.flexRow, styles.centerAlignRow)} data-testid="alertlabel-input-wrapper">
              <Field
                className={styles.labelInput}
                invalid={!!errors.labels?.[index]?.key?.message}
                error={errors.labels?.[index]?.key?.message}
              >
                <Input
                  {...register(`labels.${index}.key`, {
                    required: { value: !!labels[index]?.value, message: 'Required.' },
                  })}
                  placeholder="key"
                  data-testid={`label-key-${index}`}
                  defaultValue={field.key}
                />
              </Field>
              <InlineLabel className={styles.equalSign}>=</InlineLabel>
              <Field
                className={styles.labelInput}
                invalid={!!errors.labels?.[index]?.value?.message}
                error={errors.labels?.[index]?.value?.message}
              >
                <Input
                  {...register(`labels.${index}.value`, {
                    required: { value: !!labels[index]?.key, message: 'Required.' },
                  })}
                  placeholder="value"
                  data-testid={`label-value-${index}`}
                  defaultValue={field.value}
                />
              </Field>
              <RemoveButton className={styles.deleteLabelButton} index={index} remove={remove} />
            </div>
          </div>
        );
      })}
      <AddButton className={styles.addLabelButton} append={append} />
    </>
  );
};

interface LabelsFieldProps {
  dataSourceName?: string;
}

function LabelsField({ dataSourceName }: LabelsFieldProps) {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <Stack direction="column" gap={1}>
        <Text element="h5">Labels</Text>
        <Stack direction={'row'} gap={1}>
          <Text variant="bodySmall" color="secondary">
            Add labels to your rule for searching, silencing, or routing to a notification policy.
          </Text>
          <NeedHelpInfo
            contentText="The dropdown only displays labels that you have previously used for alerts.
            Select a label from the options below or type in a new one."
            title="Labels"
          />
        </Stack>
      </Stack>
      <div className={styles.labelsContainer}></div>
      {dataSourceName ? <LabelsWithSuggestions dataSourceName={dataSourceName} /> : <LabelsWithoutSuggestions />}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    icon: css({
      marginRight: theme.spacing(0.5),
    }),
    flexColumn: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    flexRow: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      '& + button': {
        marginLeft: theme.spacing(0.5),
      },
    }),
    deleteLabelButton: css({
      marginLeft: theme.spacing(0.5),
      alignSelf: 'flex-start',
    }),
    addLabelButton: css({
      flexGrow: 0,
      alignSelf: 'flex-start',
    }),
    centerAlignRow: css({
      alignItems: 'baseline',
    }),
    equalSign: css({
      alignSelf: 'flex-start',
      width: '28px',
      justifyContent: 'center',
      marginLeft: theme.spacing(0.5),
    }),
    labelInput: css({
      width: '175px',
      marginBottom: `-${theme.spacing(1)}`,
      '& + &': {
        marginLeft: theme.spacing(1),
      },
    }),
    labelsContainer: css({
      marginBottom: theme.spacing(3),
    }),
  };
};

export default LabelsField;
