import { css } from '@emotion/css';
import React, { FC } from 'react';
import { useFormContext } from 'react-hook-form';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Field, InputControl, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';

import { RuleFormType, RuleFormValues } from '../../../types/rule-form';
import { CloudRulesSourcePicker } from '../CloudRulesSourcePicker';
import { RuleTypePicker } from '../rule-types/RuleTypePicker';

interface Props {
  editingExistingRule: boolean;
}

export const AlertType: FC<Props> = ({ editingExistingRule }) => {
  const { enabledRuleTypes, defaultRuleType } = getAvailableRuleTypes();

  const {
    control,
    formState: { errors },
    getValues,
    setValue,
    watch,
  } = useFormContext<RuleFormValues & { location?: string }>();

  const styles = useStyles2(getStyles);
  const ruleFormType = watch('type');

  return (
    <>
      {!editingExistingRule && (
        <Field error={errors.type?.message} invalid={!!errors.type?.message} data-testid="alert-type-picker">
          <InputControl
            render={({ field: { onChange } }) => (
              <RuleTypePicker
                aria-label="Rule type"
                selected={getValues('type') ?? defaultRuleType}
                onChange={onChange}
                enabledTypes={enabledRuleTypes}
              />
            )}
            name="type"
            control={control}
            rules={{
              required: { value: true, message: 'Please select alert type' },
            }}
          />
        </Field>
      )}

      <div className={styles.flexRow}>
        {(ruleFormType === RuleFormType.cloudRecording || ruleFormType === RuleFormType.cloudAlerting) && (
          <Field
            className={styles.formInput}
            label="Select data source"
            error={errors.dataSourceName?.message}
            invalid={!!errors.dataSourceName?.message}
            data-testid="datasource-picker"
          >
            <InputControl
              render={({ field: { onChange, ref, ...field } }) => (
                <CloudRulesSourcePicker
                  {...field}
                  onChange={(ds: DataSourceInstanceSettings) => {
                    // reset location if switching data sources, as different rules source will have different groups and namespaces
                    setValue('location', undefined);
                    onChange(ds?.name ?? null);
                  }}
                />
              )}
              name="dataSourceName"
              control={control}
              rules={{
                required: { value: true, message: 'Please select a data source' },
              }}
            />
          </Field>
        )}
      </div>
    </>
  );
};

function getAvailableRuleTypes() {
  const canCreateGrafanaRules = contextSrv.hasAccess(
    AccessControlAction.AlertingRuleCreate,
    contextSrv.hasEditPermissionInFolders
  );
  const canCreateCloudRules = contextSrv.hasAccess(AccessControlAction.AlertingRuleExternalWrite, contextSrv.isEditor);
  const defaultRuleType = canCreateGrafanaRules ? RuleFormType.grafana : RuleFormType.cloudAlerting;

  const enabledRuleTypes: RuleFormType[] = [];
  if (canCreateGrafanaRules) {
    enabledRuleTypes.push(RuleFormType.grafana);
  }
  if (canCreateCloudRules) {
    enabledRuleTypes.push(RuleFormType.cloudAlerting, RuleFormType.cloudRecording);
  }

  return { enabledRuleTypes, defaultRuleType };
}

const getStyles = (theme: GrafanaTheme2) => ({
  formInput: css`
    width: 330px;
    & + & {
      margin-left: ${theme.spacing(3)};
    }
  `,
  flexRow: css`
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: flex-end;
  `,
});
