import {
  CheckboxField,
  Modal,
  PasswordInputField,
  TextareaInputField,
  TextInputField,
  validators,
} from '@percona/platform-core';
import React from 'react';
import { Form, FormRenderProps } from 'react-final-form';

import { Button, HorizontalGroup, useStyles } from '@grafana/ui';
import { Messages } from 'app/percona/dbaas/DBaaS.messages';

import { PMMServerUrlWarning } from '../../PMMServerURLWarning/PMMServerUrlWarning';
import { NewKubernetesCluster } from '../Kubernetes.types';

import { onKubeConfigValueChange, pasteFromClipboard } from './AddKubernatesModal.utils';
import { AWS_CREDENTIALS_DOC_LINK } from './AddKubernetesModal.constants';
import { Messages as ModalMessages } from './AddKubernetesModal.messages';
import { getStyles } from './AddKubernetesModal.styles';
import { AddKubernetesModalProps } from './AddKubernetesModal.types';

const { required } = validators;
const {
  isEKSCheckboxLabel,
  isEKSCheckboxTooltip,
  awsAccessKeyIDLabel,
  awsAccessKeyIDTooltip,
  awsSecretAccessKeyLabel,
  awsSecretAccessKeyTooltip,
} = ModalMessages;

export const AddKubernetesModal = ({
  isVisible,
  addKubernetes,
  setAddModalVisible,
  showMonitoringWarning,
}: AddKubernetesModalProps) => {
  const styles = useStyles(getStyles);

  return (
    <Modal title={Messages.kubernetes.addModal.title} isVisible={isVisible} onClose={() => setAddModalVisible(false)}>
      {showMonitoringWarning && <PMMServerUrlWarning className={styles.urlWarningWrapper} />}
      <Form
        onSubmit={(values: NewKubernetesCluster) => {
          addKubernetes(values);
          setAddModalVisible(false);
        }}
        mutators={{
          setKubeConfigAndName: ([configValue, nameValue]: string[], state, { changeValue }) => {
            changeValue(state, 'kubeConfig', () => configValue);
            changeValue(state, 'name', () => nameValue);
          },
        }}
        render={({ handleSubmit, valid, pristine, values: { isEKS }, form }: FormRenderProps<NewKubernetesCluster>) => (
          <form onSubmit={handleSubmit}>
            <>
              <div className={styles.pasteButtonWrapper}>
                <Button
                  data-testid="kubernetes-paste-from-clipboard-button"
                  variant="secondary"
                  onClick={() => {
                    pasteFromClipboard(form.mutators.setKubeConfigAndName);
                  }}
                  type="button"
                  icon="copy"
                  className={styles.pasteButton}
                >
                  {Messages.kubernetes.addModal.paste}
                </Button>
              </div>
              <TextareaInputField
                name="kubeConfig"
                label={Messages.kubernetes.addModal.fields.kubeConfig}
                validators={[required]}
                inputProps={{
                  onChange: (event) => {
                    onKubeConfigValueChange(event?.target?.value, form.mutators.setKubeConfigAndName);
                  },
                }}
              />
              <CheckboxField
                name="isEKS"
                label={isEKSCheckboxLabel}
                fieldClassName={styles.checkbox}
                tooltipIcon="info-circle"
                tooltipText={isEKSCheckboxTooltip}
              />
              {isEKS && (
                <>
                  <TextInputField
                    name="awsAccessKeyID"
                    label={awsAccessKeyIDLabel}
                    tooltipIcon="info-circle"
                    tooltipText={awsAccessKeyIDTooltip}
                    tooltipLink={AWS_CREDENTIALS_DOC_LINK}
                    validators={[required]}
                  />
                  <PasswordInputField
                    name="awsSecretAccessKey"
                    label={awsSecretAccessKeyLabel}
                    tooltipIcon="info-circle"
                    tooltipText={awsSecretAccessKeyTooltip}
                    tooltipLink={AWS_CREDENTIALS_DOC_LINK}
                    validators={[required]}
                  />
                </>
              )}
              <TextInputField
                name="name"
                label={Messages.kubernetes.addModal.fields.clusterName}
                validators={[required]}
              />
              <HorizontalGroup justify="center" spacing="md">
                <Button
                  type="submit"
                  data-testid="kubernetes-add-cluster-button"
                  size="md"
                  variant="primary"
                  disabled={!valid || pristine}
                >
                  {Messages.kubernetes.addModal.confirm}
                </Button>
              </HorizontalGroup>
            </>
          </form>
        )}
      />
    </Modal>
  );
};
