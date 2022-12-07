/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { LoaderButton, Modal, logger } from '@percona/platform-core';
import { FormApi } from 'final-form';
import React, { FC } from 'react';
import { Form, Field, FormRenderProps } from 'react-final-form';

import { AppEvents, SelectableValue } from '@grafana/data';
import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { Overlay } from 'app/percona/shared/components/Elements/Overlay/Overlay';
import { SelectFieldAdapter } from 'app/percona/shared/components/Form/FieldAdapters/FieldAdapters';
import { MultiCheckboxField } from 'app/percona/shared/components/Form/MultiCheckbox/MultiCheckboxField';
import { Databases } from 'app/percona/shared/core';

import { DATABASE_OPERATORS } from '../../DBCluster/DBCluster.constants';
import { newDBClusterService } from '../../DBCluster/DBCluster.utils';
import { Operators } from '../../DBCluster/EditDBClusterPage/DBClusterBasicOptions/DBClusterBasicOptions.types';
import { KubernetesOperatorStatus } from '../OperatorStatusItem/KubernetesOperatorStatus/KubernetesOperatorStatus.types';

import { useOperatorsComponentsVersions } from './ManageComponentsVersions.hooks';
import {
  requiredVersions,
  buildVersionsFieldName,
  findRecommendedVersions,
  getDefaultOptions,
  defaultRequired,
  buildDefaultFieldName,
  parseDefaultVersionsOptions,
} from './ManageComponentsVersions.utils';
import { Messages } from './ManageComponentsVersionsModal.messages';
import { getStyles } from './ManageComponentsVersionsModal.styles';
import {
  ManageComponentsVersionsModalProps,
  ManageComponentsVersionsRenderProps,
  ManageComponentVersionsFields,
} from './ManageComponentsVersionsModal.types';

export const ManageComponentsVersionsModal: FC<ManageComponentsVersionsModalProps> = ({
  selectedKubernetes,
  isVisible,
  setVisible,
  setSelectedCluster,
}) => {
  const styles = useStyles(getStyles);
  const [
    initialValues,
    operatorsOptions,
    componentOptions,
    possibleComponentOptions,
    versionsOptions,
    versionsFieldName,
    defaultFieldName,
    loadingComponents,
    setComponentOptions,
    setVersionsOptions,
    setVersionsFieldName,
    setDefaultFieldName,
  ] = useOperatorsComponentsVersions(selectedKubernetes);
  const onChangeComponent =
    (values: ManageComponentsVersionsRenderProps, change: FormApi['change']) => (component: SelectableValue) => {
      const newValues = { ...values, [ManageComponentVersionsFields.component]: component };
      const name = buildVersionsFieldName(newValues) as string;
      const defaultName = buildDefaultFieldName(newValues) as string;
      const options = values[name];

      setVersionsFieldName(name);
      setVersionsOptions(options);
      setDefaultFieldName(defaultName);

      change(ManageComponentVersionsFields.component, component);
      change(defaultName, values[defaultName]);
    };
  const onChangeOperator =
    (values: ManageComponentsVersionsRenderProps, change: FormApi['change']) => (operator: SelectableValue) => {
      const newComponentOptions = possibleComponentOptions[operator.value as Operators] as SelectableValue[];
      const newValues = {
        ...values,
        [ManageComponentVersionsFields.operator]: operator,
        [ManageComponentVersionsFields.component]: newComponentOptions[0],
      };
      const name = buildVersionsFieldName(newValues) as string;
      const defaultName = buildDefaultFieldName(newValues) as string;
      const options = values[name];

      setComponentOptions(newComponentOptions);
      setVersionsFieldName(name);
      setVersionsOptions(options);
      setDefaultFieldName(defaultName);

      change(ManageComponentVersionsFields.component, newComponentOptions[0]);
      change(ManageComponentVersionsFields.operator, operator);
      change(defaultName, values[defaultName]);
    };
  const onSubmit = async (values: ManageComponentsVersionsRenderProps) => {
    const { operators, kubernetesClusterName } = selectedKubernetes;
    const operatorsList = Object.entries(operators);

    try {
      for (const [operator, { status }] of operatorsList) {
        if (status === KubernetesOperatorStatus.ok) {
          const service = newDBClusterService(DATABASE_OPERATORS[operator as Operators] as Databases);

          await service.setComponents(kubernetesClusterName, values);
        }
      }

      setVisible(false);
      appEvents.emit(AppEvents.alertSuccess, [Messages.success]);
    } catch (e) {
      logger.error(e);
    } finally {
      setSelectedCluster(null);
    }
  };

  return (
    <Modal title={Messages.title} isVisible={isVisible} onClose={() => setVisible(false)}>
      <Overlay isPending={loadingComponents}>
        <Form
          initialValues={initialValues}
          onSubmit={onSubmit}
          render={({
            handleSubmit,
            valid,
            submitting,
            form,
            values,
          }: FormRenderProps<ManageComponentsVersionsRenderProps>) => {
            const name = buildVersionsFieldName(values);
            const defaultName = buildDefaultFieldName(values);
            const defaultVersionOptions = getDefaultOptions(values);
            const defaultVersion = defaultName ? values[defaultName] : undefined;
            const showDefaultErrorOnBlur = !defaultName && defaultVersionOptions.length === 0;
            const selectedVersions = (name ? values[name] : []) as SelectableValue[];
            const isDefaultDisabled = defaultVersion
              ? selectedVersions.find(({ name, value }) => name === defaultVersion.name && !value)
              : false;

            // clear default version when the version is disabled
            if (defaultName && defaultVersion && isDefaultDisabled) {
              form.change(defaultName, {
                value: undefined,
                label: undefined,
              });
            }

            return (
              <form onSubmit={handleSubmit}>
                <>
                  <Field
                    dataTestId="kubernetes-operator"
                    name={ManageComponentVersionsFields.operator}
                    label={Messages.fields.operator}
                    options={operatorsOptions}
                    component={SelectFieldAdapter}
                    disabled={!valid}
                    onChange={onChangeOperator(values, form.change)}
                  />
                  <Field
                    dataTestId="kubernetes-component"
                    name={ManageComponentVersionsFields.component}
                    label={Messages.fields.component}
                    options={componentOptions}
                    component={SelectFieldAdapter}
                    disabled={!valid}
                    onChange={onChangeComponent(values, form.change)}
                  />
                  <MultiCheckboxField
                    name={versionsFieldName}
                    className={styles.versionsWrapper}
                    label={Messages.fields.versions}
                    initialOptions={versionsOptions}
                    recommendedOptions={findRecommendedVersions(versionsOptions)}
                    recommendedLabel={Messages.recommended}
                    validators={[requiredVersions]}
                  />
                  <Field
                    dataTestId="kubernetes-default-version"
                    className={styles.defaultWrapper}
                    name={defaultFieldName}
                    label={Messages.fields.default}
                    options={parseDefaultVersionsOptions(defaultVersionOptions)}
                    showErrorOnBlur={showDefaultErrorOnBlur}
                    component={SelectFieldAdapter}
                    validate={defaultRequired}
                  />
                  <HorizontalGroup justify="space-between" spacing="md">
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => setVisible(false)}
                      data-testid="kubernetes-components-versions-cancel"
                    >
                      {Messages.cancel}
                    </Button>
                    <LoaderButton
                      variant="primary"
                      size="md"
                      disabled={!valid}
                      loading={submitting}
                      data-testid="kubernetes-components-versions-save"
                      type="submit"
                    >
                      {Messages.save}
                    </LoaderButton>
                  </HorizontalGroup>
                </>
              </form>
            );
          }}
        />
      </Overlay>
    </Modal>
  );
};
