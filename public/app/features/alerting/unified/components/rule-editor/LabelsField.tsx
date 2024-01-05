import { css, cx } from '@emotion/css';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useFieldArray, UseFieldArrayAppend, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  Button,
  Field,
  InlineLabel,
  Input,
  InputControl,
  LoadingPlaceholder,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { useDispatch } from 'app/types';

import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchRulerRulesIfNotFetchedYet } from '../../state/actions';
import { RuleFormValues } from '../../types/rule-form';
import AlertLabelDropdown from '../AlertLabelDropdown';

import { NeedHelpInfo } from './NeedHelpInfo';

interface Props {
  className?: string;
  dataSourceName?: string | null;
}

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

const RemoveButton: FC<{
  remove: (index?: number | number[] | undefined) => void;
  className: string;
  index: number;
}> = ({ remove, className, index }) => (
  <Button
    className={className}
    aria-label="delete label"
    icon="trash-alt"
    data-testid={`delete-label-${index}`}
    variant="secondary"
    onClick={() => {
      remove(index);
    }}
  />
);

const AddButton: FC<{
  append: UseFieldArrayAppend<RuleFormValues, 'labels'>;
  className: string;
}> = ({ append, className }) => (
  <Button
    className={className}
    icon="plus-circle"
    type="button"
    variant="secondary"
    onClick={() => {
      append({ key: '', value: '' });
    }}
  >
    Add label
  </Button>
);

const LabelsWithSuggestions: FC<{ dataSourceName: string }> = ({ dataSourceName }) => {
  const styles = useStyles2(getStyles);
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  const labels = watch('labels');
  const { fields, remove, append } = useFieldArray({ control, name: 'labels' });

  const { loading, labelsByKey } = useGetCustomLabels(dataSourceName);

  const [selectedKey, setSelectedKey] = useState('');

  const keys = useMemo(() => {
    return mapLabelsToOptions(Object.keys(labelsByKey));
  }, [labelsByKey]);

  const getValuesForLabel = useCallback(
    (key: string) => {
      return mapLabelsToOptions(labelsByKey[key]);
    },
    [labelsByKey]
  );

  const values = useMemo(() => {
    return getValuesForLabel(selectedKey);
  }, [selectedKey, getValuesForLabel]);

  return (
    <>
      {loading && <LoadingPlaceholder text="Loading" />}
      {!loading && (
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
                    <InputControl
                      name={`labels.${index}.key`}
                      control={control}
                      rules={{ required: Boolean(labels[index]?.value) ? 'Required.' : false }}
                      render={({ field: { onChange, ref, ...rest } }) => {
                        return (
                          <AlertLabelDropdown
                            {...rest}
                            defaultValue={field.key ? { label: field.key, value: field.key } : undefined}
                            options={keys}
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
                    <InputControl
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

const LabelsWithoutSuggestions: FC = () => {
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

const LabelsField: FC<Props> = ({ dataSourceName }) => {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <Stack direction="column" gap={1}>
        <Text element="h5">Labels</Text>
        <Stack direction={'row'} gap={1}>
          <Text variant="bodySmall" color="secondary">
            Add labels to your rule to annotate your rules, ease searching, or route to a notification policy.
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
};

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
