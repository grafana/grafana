import { css, cx } from '@emotion/css';
import { FC, useCallback, useMemo, useState } from 'react';
import { Controller, FormProvider, useFieldArray, useForm, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Button, Field, InlineLabel, Input, LoadingPlaceholder, Space, Stack, Text, useStyles2 } from '@grafana/ui';

import { labelsApi } from '../../../api/labelsApi';
import { usePluginBridge } from '../../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../../types/pluginBridges';
import { RuleFormValues } from '../../../types/rule-form';
import { isPrivateLabelKey } from '../../../utils/labels';
import AlertLabelDropdown from '../../AlertLabelDropdown';
import { AlertLabels } from '../../AlertLabels';
import { NeedHelpInfo } from '../NeedHelpInfo';
import { useAlertRuleSuggestions } from '../useAlertRuleSuggestions';

import { AddButton, RemoveButton } from './LabelsButtons';

const useGetOpsLabelsKeys = (skip: boolean) => {
  const { currentData, isLoading: isloadingLabels } = labelsApi.endpoints.getLabels.useQuery(undefined, {
    skip,
  });
  return { loading: isloadingLabels, labelsOpsKeys: currentData };
};

function mapLabelsToOptions(
  items: Iterable<string> = [],
  labelsInSubForm?: Array<{ key: string; value: string }>
): Array<SelectableValue<string>> {
  const existingKeys = new Set(labelsInSubForm ? labelsInSubForm.map((label) => label.key) : []);
  return Array.from(items, (item) => ({ label: item, value: item, isDisabled: existingKeys.has(item) }));
}

export interface LabelsInRuleProps {
  labels: Array<{ key: string; value: string }>;
}

export const LabelsInRule = ({ labels }: LabelsInRuleProps) => {
  const labelsObj: Record<string, string> = labels.reduce((acc: Record<string, string>, label) => {
    if (label.key) {
      acc[label.key] = label.value;
    }
    return acc;
  }, {});

  return <AlertLabels labels={labelsObj} />;
};

export type LabelsSubformValues = {
  labelsInSubform: Array<{ key: string; value: string }>;
};

export interface LabelsSubFormProps {
  dataSourceName: string;
  initialLabels: Array<{ key: string; value: string }>;
  onClose: (
    labelsToUodate?: Array<{
      key: string;
      value: string;
    }>
  ) => void;
}

export function LabelsSubForm({ dataSourceName, onClose, initialLabels }: LabelsSubFormProps) {
  const styles = useStyles2(getStyles);

  const onSave = (labels: LabelsSubformValues) => {
    onClose(labels.labelsInSubform);
  };
  const onCancel = () => {
    onClose();
  };
  // default values for the subform are the initial labels
  const defaultValues: LabelsSubformValues = useMemo(() => {
    return { labelsInSubform: initialLabels };
  }, [initialLabels]);

  const formAPI = useForm<LabelsSubformValues>({ defaultValues });
  return (
    <FormProvider {...formAPI}>
      <form onSubmit={formAPI.handleSubmit(onSave)}>
        <Stack direction="column" gap={4}>
          <Text>Add labels to your rule for searching, silencing, or routing to a notification policy.</Text>
          <Stack direction="column" gap={1}>
            <LabelsWithSuggestions dataSourceName={dataSourceName} />
            <Space v={2} />
            <LabelsInRule labels={formAPI.watch('labelsInSubform')} />
            <Space v={1} />
            <div className={styles.confirmButton}>
              <Button type="button" variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </div>
          </Stack>
        </Stack>
      </form>
    </FormProvider>
  );
}

const isKeyAllowed = (labelKey: string) => !isPrivateLabelKey(labelKey);

export function useCombinedLabels(
  dataSourceName: string,
  labelsPluginInstalled: boolean,
  loadingLabelsPlugin: boolean,
  labelsInSubform: Array<{ key: string; value: string }>,
  selectedKey: string
) {
  // ------- Get labels keys and their values from existing alerts
  const { isLoading, labels: labelsByKeyFromExisingAlerts } = useAlertRuleSuggestions(dataSourceName);
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
    return mapLabelsToOptions(Object.keys(labelsByKeyOps).filter(isKeyAllowed), labelsInSubform);
  }, [labelsByKeyOps, labelsInSubform]);

  //------- Convert the keys from the existing alerts to options for the dropdown
  const keysFromExistingAlerts = useMemo(() => {
    return mapLabelsToOptions(Array.from(labelsByKeyFromExisingAlerts.keys()).filter(isKeyAllowed), labelsInSubform);
  }, [labelsByKeyFromExisingAlerts, labelsInSubform]);

  // create two groups of labels, one for ops and one for custom
  const groupedOptions = [
    {
      label: 'From alerts',
      options: keysFromExistingAlerts,
      expanded: true,
    },
    {
      label: 'From system',
      options: keysFromGopsLabels,
      expanded: true,
    },
  ];

  const selectedKeyIsFromAlerts = labelsByKeyFromExisingAlerts.has(selectedKey);
  const selectedKeyIsFromOps = labelsByKeyOps[selectedKey] !== undefined && labelsByKeyOps[selectedKey]?.size > 0;
  const selectedKeyDoesNotExist = !selectedKeyIsFromAlerts && !selectedKeyIsFromOps;

  const valuesAlreadyFetched = !selectedKeyIsFromAlerts && labelsByKeyOps[selectedKey]?.size > 0;

  // Only fetch the values for the selected key if it is from ops and the values are not already fetched (the selected key is not in the labelsByKeyOps object)
  const {
    currentData: valuesData,
    isLoading: isLoadingValues = false,
    error,
  } = labelsApi.endpoints.getLabelValues.useQuery(
    { key: selectedKey },
    {
      skip:
        !labelsPluginInstalled ||
        !selectedKey ||
        selectedKeyIsFromAlerts ||
        valuesAlreadyFetched ||
        selectedKeyDoesNotExist,
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
      if (!isKeyAllowed(key)) {
        return [];
      }

      // values from existing alerts will take precedence over values from ops
      if (selectedKeyIsFromAlerts || !labelsPluginInstalled) {
        return mapLabelsToOptions(labelsByKeyFromExisingAlerts.get(key));
      }
      return valuesFromSelectedGopsKey;
    },
    [labelsByKeyFromExisingAlerts, labelsPluginInstalled, valuesFromSelectedGopsKey, selectedKeyIsFromAlerts]
  );

  return {
    loading: isLoading || isLoadingLabels,
    keysFromExistingAlerts,
    groupedOptions,
    getValuesForLabel,
  };
}

/*
  We will suggest labels from two sources: existing alerts and ops labels.
  We only will suggest labels from ops if the grafana-labels-app plugin is installed
  This component is only used by the alert rule form.
  */
export interface LabelsWithSuggestionsProps {
  dataSourceName: string;
}

export function LabelsWithSuggestions({ dataSourceName }: LabelsWithSuggestionsProps) {
  const styles = useStyles2(getStyles);
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<LabelsSubformValues>();

  const labelsInSubform = watch('labelsInSubform');
  const { fields, remove, append } = useFieldArray({ control, name: 'labelsInSubform' });
  const appendLabel = useCallback(() => {
    append({ key: '', value: '' });
  }, [append]);

  // check if the labels plugin is installed
  const { installed: labelsPluginInstalled = false, loading: loadingLabelsPlugin } = usePluginBridge(
    SupportedPlugin.Labels
  );
  const [selectedKey, setSelectedKey] = useState('');

  const { loading, keysFromExistingAlerts, groupedOptions, getValuesForLabel } = useCombinedLabels(
    dataSourceName,
    labelsPluginInstalled,
    loadingLabelsPlugin,
    labelsInSubform,
    selectedKey
  );

  const values = useMemo(() => {
    return getValuesForLabel(selectedKey);
  }, [selectedKey, getValuesForLabel]);

  const isLoading = loading || loadingLabelsPlugin;

  return (
    <>
      {isLoading && <LoadingPlaceholder text="Loading existing labels" />}
      {!isLoading && (
        <Stack direction="column" gap={1} alignItems="flex-start">
          {fields.map((field, index) => {
            return (
              <div key={field.id} className={cx(styles.flexRow, styles.centerAlignRow)}>
                <Field
                  className={styles.labelInput}
                  invalid={Boolean(errors.labelsInSubform?.[index]?.key?.message)}
                  error={errors.labelsInSubform?.[index]?.key?.message}
                  data-testid={`labelsInSubform-key-${index}`}
                >
                  <Controller
                    name={`labelsInSubform.${index}.key`}
                    control={control}
                    rules={{ required: Boolean(labelsInSubform[index]?.value) ? 'Required.' : false }}
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
                  invalid={Boolean(errors.labelsInSubform?.[index]?.value?.message)}
                  error={errors.labelsInSubform?.[index]?.value?.message}
                  data-testid={`labelsInSubform-value-${index}`}
                >
                  <Controller
                    control={control}
                    name={`labelsInSubform.${index}.value`}
                    rules={{ required: Boolean(labelsInSubform[index]?.value) ? 'Required.' : false }}
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
                            setSelectedKey(labelsInSubform[index].key);
                          }}
                          type="value"
                        />
                      );
                    }}
                  />
                </Field>

                <RemoveButton index={index} remove={remove} />
              </div>
            );
          })}
          <AddButton append={appendLabel} />
        </Stack>
      )}
    </>
  );
}

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
  const appendLabel = useCallback(() => {
    append({ key: '', value: '' });
  }, [append]);

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
              <RemoveButton index={index} remove={remove} />
            </div>
          </div>
        );
      })}
      <AddButton append={appendLabel} />
    </>
  );
};

function LabelsField() {
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
      <LabelsWithoutSuggestions />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    flexColumn: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    flexRow: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-start',
    }),
    centerAlignRow: css({
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    equalSign: css({
      alignSelf: 'flex-start',
      width: '28px',
      justifyContent: 'center',
      margin: 0,
    }),
    labelInput: css({
      width: '175px',
      margin: 0,
    }),
    confirmButton: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(1),
      marginLeft: 'auto',
    }),
  };
};

export default LabelsField;
