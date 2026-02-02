import { css } from '@emotion/css';
import { FC, memo, useEffect, useState } from 'react';

import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Spinner, stylesFactory, useTheme, Field, Input, Select, CallToActionCard, Switch, Button } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ModifyActions } from '../../types';
import { isSaveEnabled } from '../../utils';
import { useModifyFields } from '../hooks/useModifyFields';

import { RawQueryEditor } from './RawQueryEditor';

export interface Props {
  action: string;
  uid?: string;
}

export const FieldsForm: FC<Props> = memo(({ action, uid }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const {
    forms,
    modules,
    columns,
    fields,
    loading,
    errMsg,
    onFormChange,
    onModuleChange,
    onNameChange,
    onQueryChange,
    toggleAgg,
    validateRawQuery,
    createField,
    updateField,
  } = useModifyFields(action, uid);

  const [formOptions, setFormOptions] = useState<SelectableValue[]>([]);
  useEffect(() => {
    const options: SelectableValue[] = [];
    forms.map((item: string) => {
      options.push({ label: item, value: item });
    });
    setFormOptions(options);
  }, [forms]);
  const [moduleOptions, setModuleOptions] = useState<SelectableValue[]>([]);
  useEffect(() => {
    const options: SelectableValue[] = [];
    modules.map((item: string) => {
      options.push({ label: item, value: item });
    });
    setModuleOptions(options);
  }, [modules]);
  if (errMsg) {
    return <CallToActionCard className={styles.ctaStyle} message={errMsg} callToActionElement={<></>} />;
  }

  if (loading) {
    return <Spinner className={styles.spinner} />;
  }

  const isEditCalcField = action === ModifyActions.EDIT;

  const editText = t('bmc.calc-fields.edit-field', 'Edit Calculated Field');
  const newText = t('bmc.calc-fields.new-field', 'New Calculated Field');
  const namePlaceholder = t('bmc.calc-fields.name-placeholder', 'Enter the name of the calculated field');
  return (
    <div className={styles.container}>
      <h2 className="page-sub-heading">{isEditCalcField ? editText : newText}</h2>
      <div className={styles.formContainer}>
        <Field label={t('bmc.calc-fields.name', 'Name')} required={true} disabled={isEditCalcField}>
          <Input id="field-name" value={fields.name} onChange={onNameChange} placeholder={namePlaceholder} />
        </Field>
        <Field label={t('bmc.calc-fields.form-name', 'Form name')} required={true} disabled={isEditCalcField}>
          <Select
            options={formOptions}
            onChange={onFormChange}
            value={fields.formName && { label: fields.formName, value: fields.formName }}
            placeholder={t('bmc.calc-fields.select-form', 'Select form')}
          />
        </Field>
        <Field label={t('bmc.calc-fields.module-name', 'Module name')} required={true}>
          <Select
            options={moduleOptions}
            onChange={onModuleChange}
            value={fields.module && { label: fields.module, value: fields.module }}
            placeholder={t('bmc.calc-fields.select-module', 'Select module')}
            allowCustomValue={true}
          />
        </Field>
        <RawQueryEditor
          query={fields.sqlQuery}
          columns={columns}
          formName={fields.formName}
          onQueryChange={onQueryChange}
          queryValidated={fields.rawQueryValidated}
          validateRawQuery={validateRawQuery}
        />
        <Field
          label={t('bmc.calc-fields.is-aggregate', 'Is aggregate')}
          description={t(
            'bmc.calc-fields.is-aggregate-description',
            'Enable this option if your query includes aggregation functions.'
          )}
          horizontal
          disabled={isEditCalcField}
        >
          <Switch checked={fields.Aggregation} onChange={toggleAgg} />
        </Field>
        <div
          className={css`
            display: flex;
            justify-content: start;
            margin-top: 15px;
          `}
        >
          <Button
            size="md"
            style={{ marginRight: '15px' }}
            fill="solid"
            disabled={!isSaveEnabled(fields)}
            onClick={isEditCalcField ? updateField : createField}
          >
            {isEditCalcField ? t('bmc.calc-fields.update', 'Update') : t('bmc.calc-fields.save', 'Save')}
          </Button>
          <Button
            size="md"
            variant="secondary"
            fill="solid"
            onClick={() => {
              locationService.push({ pathname: '/calculated-fields' });
            }}
          >
            <Trans i18nKey="bmc.common.cancel">Cancel</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
});

FieldsForm.displayName = 'FieldsForm';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      height: 100%;
    `,
    formContainer: css`
      max-width: 600px;
    `,
    results: css`
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      padding-top: ${theme.spacing.xl};
    `,
    spinner: css`
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 200px;
    `,
    ctaStyle: css`
      text-align: center;
    `,
  };
});
