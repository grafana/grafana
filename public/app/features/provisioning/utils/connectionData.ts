import { type Connection, type ConnectionSpec } from 'app/api/clients/provisioning/v0alpha1';

import { type ConnectionFormData } from '../types';

import { isOAuthConnectionType } from './connectionOAuth';

export function connectionToFormData(data?: Connection): ConnectionFormData {
  const spec = data?.spec;
  const base = {
    title: spec?.title || '',
    description: spec?.description || '',
    webhookDisabled: spec?.webhook?.disabled ?? false,
  };

  if (isOAuthConnectionType(spec?.type)) {
    return {
      ...base,
      type: spec.type,
      clientID: spec.oauth?.clientID || '',
      clientSecret: '',
      workspace: spec.bitbucket?.workspace || '',
      serverUrl: spec.githubEnterpriseOAuth?.serverUrl || '',
    };
  }

  if (spec?.type === 'githubEnterprise') {
    return {
      ...base,
      type: 'githubEnterprise',
      appID: spec.githubEnterprise?.appID || '',
      installationID: spec.githubEnterprise?.installationID || '',
      privateKey: '',
      serverUrl: spec.githubEnterprise?.serverUrl || '',
    };
  }

  return {
    ...base,
    type: 'github',
    appID: spec?.github?.appID || '',
    installationID: spec?.github?.installationID || '',
    privateKey: '',
  };
}

export function getDefaultConnectionFormData(type: ConnectionFormData['type']): ConnectionFormData {
  const base = { title: '', description: '', webhookDisabled: false };

  if (isOAuthConnectionType(type)) {
    return { ...base, type, clientID: '', clientSecret: '', workspace: '', serverUrl: '' };
  }

  if (type === 'githubEnterprise') {
    return { ...base, type, appID: '', installationID: '', privateKey: '', serverUrl: '' };
  }

  return { ...base, type: 'github', appID: '', installationID: '', privateKey: '' };
}

export function connectionFormToSpec(form: ConnectionFormData): ConnectionSpec {
  const base = {
    title: form.title,
    ...(form.description && { description: form.description }),
    ...(form.webhookDisabled ? { webhook: { disabled: true } } : {}),
  };

  if (form.type === 'githubEnterprise') {
    return {
      ...base,
      type: 'githubEnterprise',
      githubEnterprise: {
        appID: form.appID ?? '',
        installationID: form.installationID ?? '',
        serverUrl: form.serverUrl,
      },
    };
  }

  if (form.type === 'github') {
    return {
      ...base,
      type: 'github',
      github: { appID: form.appID ?? '', installationID: form.installationID ?? '' },
    };
  }

  return {
    ...base,
    type: form.type,
    oauth: { clientID: form.clientID ?? '' },
    ...(form.type === 'githubEnterpriseOAuth' ? { githubEnterpriseOAuth: { serverUrl: form.serverUrl ?? '' } } : {}),
    ...(form.type === 'bitbucket' ? { bitbucket: { workspace: form.workspace ?? '' } } : {}),
  };
}
