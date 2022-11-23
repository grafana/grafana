import { logger } from '@percona/platform-core';
import { AxiosError } from 'axios';
import React, { FC, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { AppEvents } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { OldPage } from 'app/core/components/Page/Page';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { fetchServerInfoAction, fetchSettingsAction, updateSettingsAction } from 'app/percona/shared/core/reducers';
import { getPerconaServer, getPerconaSettings } from 'app/percona/shared/core/selectors';

import { Connect } from './Connect/Connect';
import { Connected } from './Connected/Connected';
import { API_INVALID_TOKEN_ERROR_CODE, CONNECT_AFTER_SETTINGS_DELAY, CONNECT_DELAY } from './Platform.constants';
import { Messages } from './Platform.messages';
import { PlatformService } from './Platform.service';
import { ConnectRenderProps, ConnectErrorBody } from './types';

export const Platform: FC = () => {
  const navModel = usePerconaNavModel('settings-percona-platform');
  const settingsStyles = useStyles2(getSettingsStyles);
  const { result } = useSelector(getPerconaSettings);
  const [connecting, setConnecting] = useState(false);
  const { serverId: pmmServerId = '' } = useSelector(getPerconaServer);
  const dispatch = useDispatch();

  const [initialValues, setInitialValues] = useState<ConnectRenderProps>({
    pmmServerName: '',
    pmmServerId,
    accessToken: '',
  });

  useEffect(() => setInitialValues((oldValues) => ({ ...oldValues, pmmServerId })), [pmmServerId]);

  const connect = async (pmmServerName: string, accessToken: string) => {
    try {
      await PlatformService.connect({
        server_name: pmmServerName,
        personal_access_token: accessToken,
      });
      // We need some short delay for changes to apply before immediately calling getSettings
      setTimeout(async () => {
        appEvents.emit(AppEvents.alertSuccess, [Messages.connectSucceeded]);
        setConnecting(false);
        dispatch(fetchServerInfoAction());
        dispatch(fetchSettingsAction());
        setInitialValues((oldValues) => ({
          ...oldValues,
          pmmServerName: '',
          accessToken: '',
        }));
      }, CONNECT_DELAY);
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const error = e as AxiosError<ConnectErrorBody>;

      if (error.response?.data?.code === API_INVALID_TOKEN_ERROR_CODE) {
        appEvents.emit(AppEvents.alertError, [Messages.invalidToken]);
      } else {
        appEvents.emit(AppEvents.alertError, [error.message]);
      }

      logger.error(e);
      setConnecting(false);
    }
  };

  const handleConnect = async ({ pmmServerName, accessToken }: ConnectRenderProps, setPMMAddress: boolean) => {
    setInitialValues((oldValues) => ({ ...oldValues, pmmServerName, accessToken }));
    setConnecting(true);
    if (setPMMAddress) {
      await dispatch(updateSettingsAction({ body: { pmm_public_address: window.location.host } }));
      setTimeout(() => connect(pmmServerName, accessToken), CONNECT_AFTER_SETTINGS_DELAY);
    } else {
      connect(pmmServerName, accessToken);
    }
  };

  return (
    <OldPage navModel={navModel} vertical tabsDataTestId="settings-tabs">
      <OldPage.Contents dataTestId="settings-tab-content" className={settingsStyles.pageContent}>
        <FeatureLoader>
          {result?.isConnectedToPortal ? (
            <Connected />
          ) : (
            <Connect initialValues={initialValues} onConnect={handleConnect} connecting={connecting} />
          )}
        </FeatureLoader>
      </OldPage.Contents>
    </OldPage>
  );
};

export default Platform;
