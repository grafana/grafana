import { useState } from 'react';
import { UseFormSetValue } from 'react-hook-form';

import { AppEvents } from '@grafana/data';
import { getAppEvents, getBackendSrv } from '@grafana/runtime';
import { Button } from '@grafana/ui';

import { Trans } from '../../../core/internationalization';
import { ServerDiscoveryFormData, SSOProviderDTO } from '../types';

import { ServerDiscoveryModal } from './ServerDiscoveryModal';

interface Props {
  setValue: UseFormSetValue<SSOProviderDTO>;
}

export const ServerDiscoveryField = ({ setValue }: Props) => {
  const appEvents = getAppEvents();
  const [isModalOpen, setModalVisibility] = useState(false);
  const [isLoading, setLoading] = useState(false);

  const onClose = () => setModalVisibility(false);
  const onSuccess = async (data: ServerDiscoveryFormData) => {
    setLoading(true);
    try {
      const wellKnownSuffix = '/.well-known/openid-configuration';
      const url = new URL(data.url);
      if (!url.pathname.includes(wellKnownSuffix)) {
        data.url = url.origin + wellKnownSuffix;
      }

      const res = await getBackendSrv().get(data.url);

      if (!res['token_endpoint'] || !res['authorization_endpoint']) {
        appEvents.publish({
          type: AppEvents.alertWarning.name,
          payload: ['The URL provided is not a valid .well-known/openid-configuration endpoint'],
        });
        return;
      }

      setValue('tokenUrl', res['token_endpoint']);
      setValue('authUrl', res['authorization_endpoint']);
      if (res['userinfo_endpoint']) {
        setValue('apiUrl', res['userinfo_endpoint']);
      }

      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['OpenID Connect Discovery URL has been successfully fetched.'],
      });
    } catch (error) {
      appEvents.publish({
        type: AppEvents.alertWarning.name,
        payload: ['Failed to fetch URL or invalid content'],
      });
    } finally {
      onClose();
      setLoading(false);
    }
  };
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setModalVisibility(true);
        }}
      >
        <Trans i18nKey={'oauth.form.server-discovery-action-button'}>Enter OpenID Connect Discovery URL</Trans>
      </Button>
      <ServerDiscoveryModal isOpen={isModalOpen} onClose={onClose} onSuccess={onSuccess} isLoading={isLoading} />
    </>
  );
};
