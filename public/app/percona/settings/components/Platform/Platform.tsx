import { AxiosError } from 'axios';
import React, { FC, useEffect, useState } from 'react';

import { AppEvents } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { TabbedPage, TabbedPageContents } from 'app/percona/shared/components/TabbedPage';
import { fetchServerInfoAction, fetchSettingsAction, updateSettingsAction } from 'app/percona/shared/core/reducers';
import { getPerconaServer, getPerconaSettings } from 'app/percona/shared/core/selectors';
import { logger } from 'app/percona/shared/helpers/logger';
import { useDispatch, useSelector } from 'app/types';

import { Connect } from './Connect/Connect';
import { Connected } from './Connected/Connected';
import { API_INVALID_TOKEN_ERROR_CODE, CONNECT_AFTER_SETTINGS_DELAY, CONNECT_DELAY } from './Platform.constants';
import { Messages } from './Platform.messages';
import { PlatformService } from './Platform.service';
import { ConnectRenderProps } from './types';

export const Platform: FC = () => {
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
      let message = null;

      if (e instanceof AxiosError) {
        if (e.response?.data?.code === API_INVALID_TOKEN_ERROR_CODE) {
          message = Messages.invalidToken;
        } else {
          message = e.response?.data.message ?? e.message;
        }
      }

      appEvents.emit(AppEvents.alertError, [message ?? Messages.unknownError]);

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
    <TabbedPage navId="settings-percona-platform" vertical>
      <TabbedPageContents dataTestId="settings-tab-content" className={settingsStyles.pageContent}>
        <FeatureLoader>
          {result?.isConnectedToPortal ? (
            <Connected />
          ) : (
            <Connect initialValues={initialValues} onConnect={handleConnect} connecting={connecting} />
          )}
        </FeatureLoader>
      </TabbedPageContents>
    </TabbedPage>
  );
};

export default Platform;
