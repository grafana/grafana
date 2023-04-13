/* eslint-disable react/display-name */
import arrayMutators from 'final-form-arrays';
import React, { FC, useCallback, useEffect, useState } from 'react';
import { Form } from 'react-final-form';
import { Redirect, useHistory } from 'react-router-dom';

import { Spinner, useStyles2 } from '@grafana/ui/src';
import { useShowPMMAddressWarning } from 'app/percona/shared/components/hooks/showPMMAddressWarning';
import { useSelector, useDispatch } from 'app/types';

import { FeatureLoader } from '../../../../shared/components/Elements/FeatureLoader';
import { fetchStorageLocations } from '../../../../shared/core/reducers/backups/backupLocations';
import { resetAddDBClusterState } from '../../../../shared/core/reducers/dbaas/addDBCluster/addDBCluster';
import { resetDBCluster } from '../../../../shared/core/reducers/dbaas/dbaas';
import { resetUpdateDBClusterState } from '../../../../shared/core/reducers/dbaas/updateDBCluster/updateDBCluster';
import { getPerconaSettingFlag, getPerconaSettings } from '../../../../shared/core/selectors';
import { Messages as DBaaSMessages } from '../../../DBaaS.messages';
import { useUpdateOfKubernetesList } from '../../../hooks/useKubernetesList';
import DBaaSPage from '../../DBaaSPage/DBaaSPage';
import {
  DBAAS_INVENTORY_URL,
  K8S_INVENTORY_URL,
} from '../../Kubernetes/EditK8sClusterPage/EditK8sClusterPage.constants';
import { PMMServerUrlWarning } from '../../PMMServerURLWarning/PMMServerUrlWarning';

import { ConfigurationFields } from './DBClusterAdvancedOptions/Configurations/Configurations.types';
import { DBClusterAdvancedOptions } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions';
import { DBClusterBasicOptions } from './DBClusterBasicOptions/DBClusterBasicOptions';
import { BasicOptionsFields } from './DBClusterBasicOptions/DBClusterBasicOptions.types';
import DBaaSBackups from './DBaaSBackups/DBaaSBackups';
import { DB_CLUSTER_INVENTORY_URL } from './EditDBClusterPage.constants';
import { Messages } from './EditDBClusterPage.messages';
import { getStyles } from './EditDBClusterPage.styles';
import { EditDBClusterPageProps } from './EditDBClusterPage.types';
import { generateUID } from './EditDBClusterPage.utils';
import NetworkAndSecurity from './NetworkAndSecurity/NetworkAndSecurity';
import Restore from './Restore/Restore';
import { useDefaultMode } from './hooks/useDefaultMode';
import { useEditDBClusterFormSubmit } from './hooks/useEditDBClusterFormSubmit';
import { useEditDBClusterPageDefaultValues } from './hooks/useEditDBClusterPageDefaultValues';
import { useEditDBClusterPageResult } from './hooks/useEditDBClusterPageResult';

export const EditDBClusterPage: FC<EditDBClusterPageProps> = () => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const history = useHistory();
  const mode = useDefaultMode();
  const { result: settings } = useSelector(getPerconaSettings);
  const [kubernetes, kubernetesLoading] = useUpdateOfKubernetesList();
  const [showPMMAddressWarning] = useShowPMMAddressWarning();
  const [showUnsafeConfigurationWarning, setShowUnsafeConfigurationWarning] = useState(false);
  const [initialValues, selectedDBCluster] = useEditDBClusterPageDefaultValues({ kubernetes, mode });
  const [onSubmit, loading, buttonMessage] = useEditDBClusterFormSubmit({ mode, showPMMAddressWarning, settings });
  const [result] = useEditDBClusterPageResult(mode);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('dbaasEnabled'), []);

  useEffect(() => {
    if (result === 'ok') {
      history.push(DB_CLUSTER_INVENTORY_URL);
    }
    return () => {
      if (mode === 'create') {
        dispatch(resetAddDBClusterState());
      } else {
        dispatch(resetDBCluster());
        dispatch(resetUpdateDBClusterState());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  useEffect(() => {
    dispatch(fetchStorageLocations());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FeatureLoader featureName={DBaaSMessages.dbaas} featureSelector={featureSelector}>
      {kubernetes === undefined || kubernetesLoading ? (
        <div data-testid="db-cluster-form-loading">
          <Spinner />
        </div>
      ) : kubernetes && kubernetes?.length > 0 ? (
        <Form
          initialValues={initialValues}
          onSubmit={onSubmit}
          mutators={{
            setClusterName: (databaseTypeValue: string, state, { changeValue }) => {
              changeValue(state, `${BasicOptionsFields.name}`, () => `${databaseTypeValue}-${generateUID()}`);
            },
            trimConfiguration: ([configuration]: string[], state, { changeValue }) => {
              changeValue(state, ConfigurationFields.configuration, () => configuration.trim());
            },
            ...arrayMutators,
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
                  disabled: !valid || pristine || loading,
                  loading,
                  buttonMessage: buttonMessage,
                }}
                pageHeader={`${mode === 'create' ? 'Create' : 'Edit'} DB Cluster`}
                pageName="db-cluster"
                cancelUrl={DBAAS_INVENTORY_URL}
                featureLoaderProps={{ featureName: DBaaSMessages.dbaas, featureSelector: featureSelector }}
              >
                {showPMMAddressWarning && <PMMServerUrlWarning />}
                <div className={styles.optionsWrapper}>
                  {mode === 'create' && <DBClusterBasicOptions kubernetes={kubernetes} form={form} />}
                  <div className={styles.switchOptionsWrapper}>
                    {!!settings?.backupEnabled && <Restore form={form} />}
                    <NetworkAndSecurity form={form} />
                    {!!settings?.backupEnabled && mode === 'create' && (
                      <DBaaSBackups
                        handleSubmit={handleSubmit}
                        pristine={pristine}
                        valid={valid}
                        form={form}
                        {...props}
                      />
                    )}
                  </div>
                  <DBClusterAdvancedOptions
                    showUnsafeConfigurationWarning={showUnsafeConfigurationWarning}
                    mode={mode}
                    form={form}
                    setShowUnsafeConfigurationWarning={setShowUnsafeConfigurationWarning}
                    selectedCluster={selectedDBCluster}
                    pristine={pristine}
                    handleSubmit={handleSubmit}
                    valid={valid}
                    {...props}
                  />
                </div>
              </DBaaSPage>
            </form>
          )}
        />
      ) : (
        <Redirect to={K8S_INVENTORY_URL} />
      )}
    </FeatureLoader>
  );
};

export default EditDBClusterPage;
