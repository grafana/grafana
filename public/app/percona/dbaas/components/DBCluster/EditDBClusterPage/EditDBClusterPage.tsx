/* eslint-disable react/display-name */
import React, { FC, useCallback, useEffect, useState } from 'react';
import { Form } from 'react-final-form';
import { useDispatch } from 'react-redux';
import { Redirect, useHistory } from 'react-router-dom';

import { CollapsableSection, Spinner, useStyles } from '@grafana/ui/src';
import { useShowPMMAddressWarning } from 'app/percona/shared/components/hooks/showPMMAddressWarning';

import { resetAddDBClusterState } from '../../../../shared/core/reducers/addDBCluster/addDBCluster';
import { getPerconaSettingFlag } from '../../../../shared/core/selectors';
import { Messages as DBaaSMessages } from '../../../DBaaS.messages';
import { useUpdateOfKubernetesList } from '../../../hooks/useKubernetesList';
import DBaaSPage from '../../DBaaSPage/DBaaSPage';
import {
  DBAAS_INVENTORY_URL,
  K8S_INVENTORY_URL,
} from '../../Kubernetes/EditK8sClusterPage/EditK8sClusterPage.constants';
import { PMMServerUrlWarning } from '../../PMMServerURLWarning/PMMServerUrlWarning';

import { DBClusterAdvancedOptions } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions';
import { DBClusterBasicOptions } from './DBClusterBasicOptions/DBClusterBasicOptions';
import { DB_CLUSTER_INVENTORY_URL } from './EditDBClusterPage.constants';
import { Messages } from './EditDBClusterPage.messages';
import { getStyles } from './EditDBClusterPage.styles';
import { AddDBClusterFields, EditDBClusterPageProps } from './EditDBClusterPage.types';
import { generateUID } from './EditDBClusterPage.utils';
import { UnsafeConfigurationWarning } from './UnsafeConfigurationsWarning/UnsafeConfigurationWarning';
import { useDefaultMode } from './hooks/useDefaultMode';
import { useEditDBClusterFormSubmit } from './hooks/useEditDBClusterFormSubmit';
import { useEditDBClusterPageDefaultValues } from './hooks/useEditDBClusterPageDefaultValues';
import { useEditDBClusterPageResult } from './hooks/useEditDBClusterPageResult';

export const EditDBClusterPage: FC<EditDBClusterPageProps> = () => {
  const styles = useStyles(getStyles);
  const dispatch = useDispatch();
  const history = useHistory();
  const mode = useDefaultMode();
  const [kubernetes, kubernetesLoading] = useUpdateOfKubernetesList();
  const [showPMMAddressWarning] = useShowPMMAddressWarning();
  const [showUnsafeConfigurationWarning, setShowUnsafeConfigurationWarning] = useState(false);
  const [initialValues] = useEditDBClusterPageDefaultValues({ kubernetes });
  const [onSubmit, loading, buttonMessage] = useEditDBClusterFormSubmit({ mode, showPMMAddressWarning });
  const [result] = useEditDBClusterPageResult(mode);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('dbaasEnabled'), []);

  useEffect(() => {
    if (result === 'ok') {
      history.push(DB_CLUSTER_INVENTORY_URL);
    }
    return () => {
      dispatch(resetAddDBClusterState());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return kubernetes === undefined || kubernetesLoading ? (
    <div data-testid="db-cluster-form-loading">
      <Spinner />
    </div>
  ) : kubernetes && kubernetes?.length > 0 ? (
    <Form
      initialValues={initialValues}
      onSubmit={(values) => onSubmit(values, showPMMAddressWarning)}
      mutators={{
        setClusterName: (databaseTypeValue: string, state, { changeValue }) => {
          changeValue(state, `${AddDBClusterFields.name}`, () => `${databaseTypeValue}-${generateUID()}`);
        },
      }}
      render={({ form, handleSubmit, valid, pristine, ...props }) => (
        <form onSubmit={handleSubmit} data-testid="create-db-cluster-page">
          <DBaaSPage
            pageToolbarProps={{
              title: Messages.dbCluster,
              parent: DBaaSMessages.dbaas,
              titleHref: DB_CLUSTER_INVENTORY_URL,
              parentHref: DBAAS_INVENTORY_URL,
            }}
            submitBtnProps={{
              disabled: !valid || pristine || loading, // TODO check in edit mode
              loading: loading, // TODO check in edit mode
              buttonMessage: buttonMessage,
            }}
            pageHeader="Create DB Cluster"
            pageName="db-cluster"
            cancelUrl={DBAAS_INVENTORY_URL}
            featureLoaderProps={{ featureName: DBaaSMessages.dbaas, featureSelector: featureSelector }}
          >
            {showPMMAddressWarning && <PMMServerUrlWarning />}
            <div className={styles.optionsWrapper}>
              <DBClusterBasicOptions kubernetes={kubernetes} form={form} />
              <CollapsableSection
                label={Messages.advancedSettings}
                isOpen={false}
                buttonDataTestId={`${mode}-dbCluster-advanced-settings`}
                className={styles.collapsableSection}
              >
                {showUnsafeConfigurationWarning && <UnsafeConfigurationWarning />}
                <DBClusterAdvancedOptions
                  setShowUnsafeConfigurationWarning={setShowUnsafeConfigurationWarning}
                  form={form}
                  handleSubmit={handleSubmit}
                  pristine={pristine}
                  valid={valid}
                  {...props}
                />
              </CollapsableSection>
            </div>
          </DBaaSPage>
        </form>
      )}
    />
  ) : (
    <Redirect to={K8S_INVENTORY_URL} />
  );
};

export default EditDBClusterPage;
