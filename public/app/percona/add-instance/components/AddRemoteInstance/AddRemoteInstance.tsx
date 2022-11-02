/* eslint-disable react/display-name */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { logger } from '@percona/platform-core';
import { FormApi } from 'final-form';
import React, { FC, useCallback, useMemo, useState } from 'react';
import { Form as FormFinal } from 'react-final-form';

import { Button, useStyles } from '@grafana/ui';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { Databases } from 'app/percona/shared/core';
import { isApiCancelError } from 'app/percona/shared/helpers/api';

import { InstanceTypesExtra, InstanceTypes, INSTANCE_TYPES_LABELS, InstanceAvailableType } from '../../panel.types';

import { ADD_AZURE_CANCEL_TOKEN, ADD_RDS_CANCEL_TOKEN } from './AddRemoteInstance.constants';
import { Messages } from './AddRemoteInstance.messages';
import AddRemoteInstanceService, { toPayload } from './AddRemoteInstance.service';
import { getStyles } from './AddRemoteInstance.styles';
import { getInstanceData, remoteToken } from './AddRemoteInstance.tools';
import {
  AddRemoteInstanceProps,
  FormValues,
  RDSPayload,
  MSAzurePayload,
  TrackingOptions,
} from './AddRemoteInstance.types';
import {
  AdditionalOptions,
  Labels,
  MainDetails,
  MongoDBConnectionDetails,
  MySQLConnectionDetails,
  PostgreSQLConnectionDetails,
} from './FormParts';
import { ExternalServiceConnectionDetails } from './FormParts/ExternalServiceConnectionDetails/ExternalServiceConnectionDetails';
import { HAProxyConnectionDetails } from './FormParts/HAProxyConnectionDetails/HAProxyConnectionDetails';

const AddRemoteInstance: FC<AddRemoteInstanceProps> = ({ instance: { type, credentials }, selectInstance }) => {
  const styles = useStyles(getStyles);

  const { remoteInstanceCredentials, discoverName } = getInstanceData(type, credentials);
  const [loading, setLoading] = useState<boolean>(false);
  const [generateToken] = useCancelToken();
  const initialValues: FormValues = { ...remoteInstanceCredentials };

  if (type === Databases.mysql) {
    initialValues.qan_mysql_perfschema = true;
  }

  if (type === Databases.postgresql) {
    initialValues.tracking = TrackingOptions.pgStatements;
  }

  const onSubmit = useCallback(
    async (values: FormValues) => {
      try {
        setLoading(true);
        if (values.isRDS) {
          await AddRemoteInstanceService.addRDS(
            toPayload(values, discoverName) as RDSPayload,
            generateToken(ADD_RDS_CANCEL_TOKEN)
          );
        } else if (values.isAzure) {
          await AddRemoteInstanceService.addAzure(
            toPayload(values, discoverName) as MSAzurePayload,
            generateToken(ADD_AZURE_CANCEL_TOKEN)
          );
        } else {
          await AddRemoteInstanceService.addRemote(type, values, generateToken(remoteToken(type)));
        }

        window.location.href = '/graph/inventory/';
      } catch (e) {
        if (isApiCancelError(e)) {
          return;
        }
        logger.error(e);
      }
      setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, discoverName]
  );

  const ConnectionDetails = useCallback(
    ({ form, type }: { form: FormApi; type: InstanceTypes | '' }) => {
      switch (type) {
        case InstanceTypesExtra.external:
          return <ExternalServiceConnectionDetails form={form} />;
        case Databases.haproxy:
          return <HAProxyConnectionDetails form={form} remoteInstanceCredentials={remoteInstanceCredentials} />;
        case Databases.postgresql:
          return <PostgreSQLConnectionDetails form={form} remoteInstanceCredentials={remoteInstanceCredentials} />;
        case Databases.mongodb:
          return <MongoDBConnectionDetails form={form} remoteInstanceCredentials={remoteInstanceCredentials} />;
        case Databases.mysql:
          return <MySQLConnectionDetails form={form} remoteInstanceCredentials={remoteInstanceCredentials} />;
        default:
          return <MainDetails form={form} remoteInstanceCredentials={remoteInstanceCredentials} />;
      }
    },
    [remoteInstanceCredentials]
  );

  const formParts = useMemo(
    () => (form: FormApi) =>
      (
        <>
          <ConnectionDetails form={form} type={type} />
          <Labels />
          {type !== InstanceTypesExtra.external && (
            <AdditionalOptions
              remoteInstanceCredentials={remoteInstanceCredentials}
              loading={loading}
              instanceType={type}
              form={form}
            />
          )}
        </>
      ),
    [ConnectionDetails, loading, remoteInstanceCredentials, type]
  );

  const getHeader = (databaseType: InstanceAvailableType) => {
    if (databaseType === InstanceTypesExtra.external) {
      return Messages.form.titles.addExternalService;
    }
    if (databaseType === '') {
      return Messages.form.titles.addRemoteInstance;
    }
    return `Add remote ${INSTANCE_TYPES_LABELS[databaseType]} Instance`;
  };

  return (
    <div className={styles.formWrapper}>
      <FormFinal
        onSubmit={onSubmit}
        initialValues={initialValues}
        mutators={{
          setValue: ([field, value], state, { changeValue }) => {
            changeValue(state, field, () => value);
          },
        }}
        render={({ form, handleSubmit }) => (
          <form onSubmit={handleSubmit} data-testid="add-remote-instance-form">
            <h4 className={styles.addRemoteInstanceTitle}>{getHeader(type)}</h4>
            {formParts(form)}
            <div className={styles.addRemoteInstanceButtons}>
              <Button id="addInstance" disabled={loading} type="submit">
                {Messages.form.buttons.addService}
              </Button>
              <Button
                variant="secondary"
                onClick={() => selectInstance({ type: '' })}
                disabled={loading}
                className={styles.returnButton}
                icon="arrow-left"
              >
                {Messages.form.buttons.toMenu}
              </Button>
            </div>
          </form>
        )}
      />
    </div>
  );
};

export default AddRemoteInstance;
