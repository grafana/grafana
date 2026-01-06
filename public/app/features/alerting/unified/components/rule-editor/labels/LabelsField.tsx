import { css, cx } from '@emotion/css';
import { FC, useCallback, useMemo } from 'react';
import { Controller, FormProvider, useFieldArray, useForm, useFormContext } from 'react-hook-form';

import { AlertLabels } from '@grafana/alerting/unstable';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, ComboboxOption, Field, InlineLabel, Input, Space, Stack, Text, useStyles2 } from '@grafana/ui';

import { labelsApi } from '../../../api/labelsApi';
import { usePluginBridge } from '../../../hooks/usePluginBridge';
import { SupportedPlugin } from '../../../types/pluginBridges';
import { KBObjectArray, RuleFormType, RuleFormValues } from '../../../types/rule-form';
import { isPrivateLabelKey } from '../../../utils/labels';
import { isRecordingRuleByType } from '../../../utils/rules';
import AlertLabelDropdown, { AsyncOptionsLoader } from '../../AlertLabelDropdown';
import { NeedHelpInfo } from '../NeedHelpInfo';
import { useGetLabelsFromDataSourceName } from '../useAlertRuleSuggestions';

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
): Array<ComboboxOption<string>> {
  const existingKeys = new Set(labelsInSubForm ? labelsInSubForm.map((label) => label.key) : []);
  return Array.from(items, (item) => ({
    label: item,
    value: item,
    disabled: existingKeys.has(item),
  }));
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
  onClose: (labelsToUodate?: KBObjectArray) => void;
}

export function LabelsSubForm({ dataSourceName, onClose, initialLabels }: LabelsSubFormProps) {
  const styles = useStyles2(getStyles);
  const { watch } = useFormContext<RuleFormValues>();

  const type = watch('type') ?? RuleFormType.grafana;

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
          <Stack direction="column" gap={1}>
            <Text>{getLabelText(type)}</Text>
            <Text variant="bodySmall" color="secondary">
              {getDescriptionText()}
            </Text>
          </Stack>
          <Stack direction="column" gap={1}>
            <LabelsWithSuggestions dataSourceName={dataSourceName} />
            <Space v={2} />
            <LabelsInRule labels={formAPI.watch('labelsInSubform')} />
            <Space v={1} />
            <div className={styles.confirmButton}>
              <Button type="button" variant="secondary" onClick={onCancel}>
                <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
              </Button>
              <Button type="submit">
                <Trans i18nKey="alerting.labels-sub-form.save">Save</Trans>
              </Button>
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
  labelsInSubform: Array<{ key: string; value: string }>
) {
  // ------- Get labels keys and their values from existing alerts
  const { labels: labelsByKeyFromExisingAlerts, isLoading } = useGetLabelsFromDataSourceName(dataSourceName);
  // ------- Get only the keys from the ops labels, as we will fetch the values for the keys once the key is selected.
  const { loading: isLoadingLabels, labelsOpsKeys = [] } = useGetOpsLabelsKeys(
    !labelsPluginInstalled || loadingLabelsPlugin
  );

  // Lazy query for fetching label values on demand
  const [fetchLabelValues] = labelsApi.endpoints.getLabelValues.useLazyQuery();

  //------ Convert the labelsOpsKeys to a Set for quick lookup
  const opsLabelKeysSet = useMemo(() => {
    return new Set(labelsOpsKeys.map((label) => label.name));
  }, [labelsOpsKeys]);

  //------- Convert the keys from the ops labels to options for the dropdown
  const keysFromGopsLabels = useMemo(() => {
    return mapLabelsToOptions(Array.from(opsLabelKeysSet).filter(isKeyAllowed), labelsInSubform);
  }, [opsLabelKeysSet, labelsInSubform]);

  //------- Convert the keys from the existing alerts to options for the dropdown
  const keysFromExistingAlerts = useMemo(() => {
    return mapLabelsToOptions(Array.from(labelsByKeyFromExisingAlerts.keys()).filter(isKeyAllowed), labelsInSubform);
  }, [labelsByKeyFromExisingAlerts, labelsInSubform]);

  // create two groups of labels, one for ops and one for custom
  const groupedOptions = [
    {
      label: t('alerting.use-combined-labels.grouped-options.label.from-alerts', 'From alerts'),
      options: keysFromExistingAlerts,
      expanded: true,
    },
    {
      label: t('alerting.use-combined-labels.grouped-options.label.from-system', 'From system'),
      options: keysFromGopsLabels,
      expanded: true,
    },
  ];

  // Create an async options loader for a specific key
  // This is called by Combobox when the dropdown menu opens
  const createAsyncValuesLoader = useCallback(
    (key: string): AsyncOptionsLoader => {
      return async (_inputValue: string): Promise<Array<ComboboxOption<string>>> => {
        if (!isKeyAllowed(key) || !key) {
          return [];
        }

        // Collect values from existing alerts first
        const valuesFromAlerts = labelsByKeyFromExisingAlerts.get(key);
        const existingValues = valuesFromAlerts ? Array.from(valuesFromAlerts) : [];

        // Collect values from ops labels (if plugin is installed)
        let opsValues: string[] = [];
        if (labelsPluginInstalled && opsLabelKeysSet.has(key)) {
          try {
            // RTK Query handles caching automatically
            const result = await fetchLabelValues({ key }, true).unwrap();
            if (result?.values?.length) {
              opsValues = result.values.map((value) => value.name);
            }
          } catch (error) {
            console.error('Failed to fetch label values for key:', key, error);
          }
        }

        // Combine: existing values first, then unique ops values (Set preserves first occurrence)
        const combinedValues = [...new Set([...existingValues, ...opsValues])];

        return mapLabelsToOptions(combinedValues);
      };
    },
    [labelsByKeyFromExisingAlerts, labelsPluginInstalled, opsLabelKeysSet, fetchLabelValues]
  );

  return {
    loading: isLoading || isLoadingLabels,
    keysFromExistingAlerts,
    groupedOptions,
    createAsyncValuesLoader,
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

  const { loading, keysFromExistingAlerts, groupedOptions, createAsyncValuesLoader } = useCombinedLabels(
    dataSourceName,
    labelsPluginInstalled,
    loadingLabelsPlugin,
    labelsInSubform
  );

  return (
    <Stack direction="column" gap={2} alignItems="flex-start">
      {fields.map((field, index) => {
        // Create an async loader for this specific row's key
        // This will be called by Combobox when the dropdown opens
        const currentKey = labelsInSubform[index]?.key || '';
        const asyncValuesLoader = createAsyncValuesLoader(currentKey);

        return (
          <div key={field.id} className={cx(styles.flexRow, styles.centerAlignRow)}>
            <Field
              noMargin
              className={styles.labelInput}
              invalid={Boolean(errors.labelsInSubform?.[index]?.key?.message)}
              error={errors.labelsInSubform?.[index]?.key?.message}
              data-testid={`labelsInSubform-key-${index}`}
            >
              <Controller
                name={`labelsInSubform.${index}.key`}
                control={control}
                rules={{ required: Boolean(labelsInSubform[index]?.value) ? 'Required.' : false }}
                render={({ field: { onChange, value, ref, ...rest } }) => {
                  return (
                    <AlertLabelDropdown
                      {...rest}
                      defaultValue={value ? { label: value, value: value } : undefined}
                      options={
                        labelsPluginInstalled
                          ? groupedOptions.flatMap((group) => group.options)
                          : keysFromExistingAlerts
                      }
                      isLoading={loading}
                      onChange={(newValue: SelectableValue) => {
                        if (newValue) {
                          onChange(newValue.value || newValue.label || '');
                        }
                      }}
                      type="key"
                    />
                  );
                }}
              />
            </Field>
            <InlineLabel className={styles.equalSign}>=</InlineLabel>
            <Field
              noMargin
              className={styles.labelInput}
              invalid={Boolean(errors.labelsInSubform?.[index]?.value?.message)}
              error={errors.labelsInSubform?.[index]?.value?.message}
              data-testid={`labelsInSubform-value-${index}`}
            >
              <Controller
                control={control}
                name={`labelsInSubform.${index}.value`}
                rules={{ required: Boolean(labelsInSubform[index]?.value) ? 'Required.' : false }}
                render={({ field: { onChange, value, ref, ...rest } }) => {
                  return (
                    <AlertLabelDropdown
                      {...rest}
                      defaultValue={value ? { label: value, value: value } : undefined}
                      options={asyncValuesLoader}
                      isLoading={loading}
                      onChange={(newValue: SelectableValue) => {
                        if (newValue) {
                          onChange(newValue.value || newValue.label || '');
                        }
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
                noMargin
                className={styles.labelInput}
                invalid={!!errors.labels?.[index]?.key?.message}
                error={errors.labels?.[index]?.key?.message}
              >
                <Input
                  {...register(`labels.${index}.key`, {
                    required: {
                      value: !!labels[index]?.value,
                      message: t('alerting.labels-without-suggestions.message.required', 'Required.'),
                    },
                  })}
                  placeholder={t('alerting.labels-without-suggestions.placeholder-key', 'key')}
                  data-testid={`label-key-${index}`}
                  defaultValue={field.key}
                />
              </Field>
              <InlineLabel className={styles.equalSign}>=</InlineLabel>
              <Field
                noMargin
                className={styles.labelInput}
                invalid={!!errors.labels?.[index]?.value?.message}
                error={errors.labels?.[index]?.value?.message}
              >
                <Input
                  {...register(`labels.${index}.value`, {
                    required: {
                      value: !!labels[index]?.key,
                      message: t('alerting.labels-without-suggestions.message.required', 'Required.'),
                    },
                  })}
                  placeholder={t('alerting.labels-without-suggestions.placeholder-value', 'value')}
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
  const { watch } = useFormContext<RuleFormValues>();

  const type = watch('type') ?? RuleFormType.grafana;

  return (
    <div>
      <Stack direction="column" gap={1}>
        <Text element="h5">
          <Trans i18nKey="alerting.labels-field.labels">Labels</Trans>
        </Text>
        <Stack direction={'row'} gap={1}>
          <Text variant="bodySmall" color="secondary">
            {getLabelText(type)}
          </Text>
          <NeedHelpInfo
            externalLink={'https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/annotation-label/'}
            linkText={`Read about labels`}
            contentText="The dropdown only displays labels that you have previously used for alerts.
            Select a label from the options below or type in a new one."
            title={t('alerting.labels-field.title-labels', 'Labels')}
          />
        </Stack>
      </Stack>
      <LabelsWithoutSuggestions />
    </div>
  );
}

function getLabelText(type: RuleFormType) {
  const isRecordingRule = type ? isRecordingRuleByType(type) : false;
  const text = isRecordingRule
    ? t('alerting.alertform.labels.recording', 'Add labels to your rule.')
    : t(
        'alerting.alertform.labels.alerting',
        'Add labels to your rule for searching, silencing, or routing to a notification policy.'
      );
  return text;
}

function getDescriptionText() {
  return t(
    'alerting.labels-sub-form.description',
    'Select a label key/value from the options below, or type a new one and press Enter.'
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
      width: '215px',
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
