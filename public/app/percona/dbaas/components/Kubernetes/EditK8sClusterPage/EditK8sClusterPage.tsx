import {
  LoaderButton,
  PasswordInputField,
  TextareaInputField,
  TextInputField,
  validators,
} from '@percona/platform-core';
import React, { useCallback, useEffect, useMemo } from 'react';
import { Form, FormRenderProps } from 'react-final-form';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { Button, Icon, LinkButton, PageToolbar, Tooltip, useStyles } from '@grafana/ui/src';

import { FeatureLoader } from '../../../../shared/components/Elements/FeatureLoader';
import { PageSwitcher } from '../../../../shared/components/PageSwitcher/PageSwitcher';
import { PageSwitcherValue } from '../../../../shared/components/PageSwitcher/PageSwitcher.types';
import { useCancelToken } from '../../../../shared/components/hooks/cancelToken.hook';
import { useShowPMMAddressWarning } from '../../../../shared/components/hooks/showPMMAddressWarning';
import { addKubernetesAction, resetAddK8SClusterState } from '../../../../shared/core/reducers/k8sCluster/k8sCluster';
import { getAddKubernetes, getPerconaSettingFlag } from '../../../../shared/core/selectors';
import { Messages as DBaaSMessages } from '../../../DBaaS.messages';
import { PMMServerUrlWarning } from '../../PMMServerURLWarning/PMMServerUrlWarning';
import { DELETE_KUBERNETES_CANCEL_TOKEN } from '../Kubernetes.constants';
import { NewKubernetesCluster } from '../Kubernetes.types';

import { AWS_CREDENTIALS_DOC_LINK, DBAAS_INVENTORY_URL, K8S_INVENTORY_URL } from './EditK8sClusterPage.constants';
import { Messages as K8sFormMessages } from './EditK8sClusterPage.messages';
import { getStyles } from './EditK8sClusterPage.styles';
import { onKubeConfigValueChange, pasteFromClipboard } from './EditK8sClusterPage.utils';
import { PageHeader } from './PageHeader/PageHeader';

const { required } = validators;
const {
  pageTitle,
  awsAccessKeyIDLabel,
  awsAccessKeyIDTooltip,
  awsSecretAccessKeyLabel,
  awsSecretAccessKeyTooltip,
  confirm,
  paste,
  fields,
  cancelButton,
  genericRadioButton,
  eksRadioButton,
  isEKSRadioTooltip,
} = K8sFormMessages;

const { dbaas, kubernetes } = DBaaSMessages;

export const EditK8sClusterPage = () => {
  const styles = useStyles(getStyles);
  const dispatch = useDispatch();
  const history = useHistory();
  const { result: addK8SClusterResult, loading: addK8SClusterLoading } = useSelector(getAddKubernetes);
  const [showPMMAddressWarning] = useShowPMMAddressWarning();
  const [generateToken] = useCancelToken();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('dbaasEnabled'), []);

  const pageSwitcherValues: Array<PageSwitcherValue<boolean>> = useMemo(
    () => [
      { name: 'isEKS', value: false, label: genericRadioButton },
      { name: 'isEKS', value: true, label: eksRadioButton },
    ],
    []
  );

  const addKubernetes = useCallback(async (cluster: NewKubernetesCluster, setPMMAddress = false) => {
    await dispatch(
      addKubernetesAction({
        kubernetesToAdd: cluster,
        setPMMAddress,
        token: generateToken(DELETE_KUBERNETES_CANCEL_TOKEN),
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (addK8SClusterResult === 'ok') {
      history.push(K8S_INVENTORY_URL);
    }
    return () => {
      dispatch(resetAddK8SClusterState());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addK8SClusterResult]);

  return (
    <Form
      onSubmit={(values: NewKubernetesCluster) => {
        addKubernetes(values, showPMMAddressWarning);
      }}
      mutators={{
        setKubeConfigAndName: ([configValue, nameValue]: string[], state, { changeValue }) => {
          changeValue(state, 'kubeConfig', () => configValue);
          changeValue(state, 'name', () => nameValue);
        },
      }}
      initialValues={{ isEKS: false }}
      render={({ handleSubmit, valid, pristine, form, values: { isEKS } }: FormRenderProps<NewKubernetesCluster>) => (
        <form onSubmit={handleSubmit}>
          <>
            <PageToolbar
              title={pageTitle}
              parent={dbaas}
              titleHref={K8S_INVENTORY_URL}
              parentHref={DBAAS_INVENTORY_URL}
              className={styles.pageToolbarWrapper}
            >
              <LinkButton href={K8S_INVENTORY_URL} data-testid="cancel-button" variant="secondary" fill="outline">
                {cancelButton}
              </LinkButton>
              <LoaderButton
                data-testid="k8s-cluster-submit-button"
                size="md"
                type="submit"
                variant="primary"
                disabled={!valid || pristine}
                loading={addK8SClusterLoading}
              >
                {confirm}
              </LoaderButton>
            </PageToolbar>
            <PageHeader header={kubernetes.addAction} />
            <FeatureLoader featureName={dbaas} featureSelector={featureSelector}>
              {showPMMAddressWarning && <PMMServerUrlWarning className={styles.pmmUrlWarning} />}
              <div className={styles.pageContent}>
                <div className={styles.radioGroup}>
                  <PageSwitcher values={pageSwitcherValues} />
                  <Tooltip content={isEKSRadioTooltip}>
                    <Icon data-testid="eks-info-icon" name="info-circle" className={styles.radioInfoIcon} />
                  </Tooltip>
                </div>
                <TextareaInputField
                  name="kubeConfig"
                  label={
                    <>
                      <div>{fields.kubeConfig}</div>
                      <Button
                        data-testid="kubernetes-paste-from-clipboard-button"
                        variant="primary"
                        fill="outline"
                        onClick={() => {
                          pasteFromClipboard(form.mutators.setKubeConfigAndName);
                        }}
                        type="button"
                        icon="percona-asterisk"
                      >
                        {paste}
                      </Button>
                    </>
                  }
                  validators={[required]}
                  inputProps={{
                    onChange: (event) => {
                      onKubeConfigValueChange(event?.target?.value, form.mutators.setKubeConfigAndName);
                    },
                  }}
                  fieldClassName={styles.k8ConfigField}
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
                      fieldClassName={styles.awsField}
                    />
                    <PasswordInputField
                      name="awsSecretAccessKey"
                      label={awsSecretAccessKeyLabel}
                      tooltipIcon="info-circle"
                      tooltipText={awsSecretAccessKeyTooltip}
                      tooltipLink={AWS_CREDENTIALS_DOC_LINK}
                      validators={[required]}
                      fieldClassName={styles.awsField}
                    />
                  </>
                )}
                <TextInputField
                  name="name"
                  label={fields.clusterName}
                  validators={[required]}
                  fieldClassName={styles.k8sField}
                />
              </div>
            </FeatureLoader>
          </>
        </form>
      )}
    />
  );
};

export default EditK8sClusterPage;
