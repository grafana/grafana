import { type Connection, type ConnectionSpec } from 'app/api/clients/provisioning/v0alpha1';

import { type ConnectionFormData } from '../types';

import { isOAuthConnectionType } from './connectionOAuth';

export type ConnectionProvider = 'github' | 'githubEnterprise' | 'gitlab' | 'bitbucket';

export function toConnectionType(provider: ConnectionProvider, kind: 'app' | 'oauth'): ConnectionFormData['type'] {
  if (provider === 'github') {
    return kind === 'oauth' ? 'githubOAuth' : 'github';
  }
  if (provider === 'githubEnterprise') {
    return kind === 'oauth' ? 'githubEnterpriseOAuth' : 'githubEnterprise';
  }
  return provider;
}

export function getConnectionFormDefaults(type: string | undefined, data?: Connection): ConnectionFormData {
  const base = {
    title: data?.spec?.title || '',
    description: data?.spec?.description || '',
    webhookDisabled: data?.spec?.webhook?.disabled ?? false,
  };

  if (isOAuthConnectionType(type)) {
    return {
      ...base,
      type,
      clientID: data?.spec?.oauth?.clientID || '',
      clientSecret: '',
      workspace: data?.spec?.bitbucket?.workspace || '',
      serverUrl: data?.spec?.githubEnterpriseOAuth?.serverUrl || '',
    };
  }

  if (type === 'githubEnterprise') {
    return {
      ...base,
      type: 'githubEnterprise',
      appID: data?.spec?.githubEnterprise?.appID || '',
      installationID: data?.spec?.githubEnterprise?.installationID || '',
      privateKey: '',
      serverUrl: data?.spec?.githubEnterprise?.serverUrl || '',
    };
  }

  return {
    ...base,
    type: 'github',
    appID: data?.spec?.github?.appID || '',
    installationID: data?.spec?.github?.installationID || '',
    privateKey: '',
  };
}

export function connectionSpecFromForm(form: ConnectionFormData): ConnectionSpec {
  const base = {
    title: form.title,
    ...(form.description && { description: form.description }),
    ...(form.webhookDisabled ? { webhook: { disabled: true } } : {}),
  };

  switch (form.type) {
    case 'github':
      return {
        ...base,
        type: 'github',
        github: {
          appID: form.appID ?? '',
          installationID: form.installationID ?? '',
        },
      };
    case 'githubEnterprise':
      return {
        ...base,
        type: 'githubEnterprise',
        githubEnterprise: {
          appID: form.appID ?? '',
          installationID: form.installationID ?? '',
          serverUrl: form.serverUrl,
        },
      };
    default:
      return {
        ...base,
        type: form.type,
        oauth: { clientID: form.clientID ?? '' },
        ...(form.type === 'githubEnterpriseOAuth'
          ? { githubEnterpriseOAuth: { serverUrl: form.serverUrl ?? '' } }
          : {}),
        ...(form.type === 'bitbucket' ? { bitbucket: { workspace: form.workspace ?? '' } } : {}),
      };
  }
}
