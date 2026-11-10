import { type ErrorDetails } from 'app/api/clients/provisioning/v0alpha1';

import { getConfigFormErrors, getConnectionFormErrors, getFormErrors } from './getFormErrors';

describe('getConnectionFormErrors', () => {
  it('maps GitHub Enterprise server URL errors to the serverUrl field', () => {
    const errors: ErrorDetails[] = [
      { field: 'spec.githubEnterprise.serverUrl', detail: 'Invalid server URL', type: 'FieldValueInvalid' },
    ];

    expect(getConnectionFormErrors(errors)).toEqual([['serverUrl', { message: 'Invalid server URL' }]]);
  });

  it('maps a bare serverUrl error to the serverUrl field', () => {
    const errors: ErrorDetails[] = [
      { field: 'serverUrl', detail: 'Server URL is required', type: 'FieldValueRequired' },
    ];

    expect(getConnectionFormErrors(errors)).toEqual([['serverUrl', { message: 'Server URL is required' }]]);
  });

  it('maps GitHub Enterprise appID and installationID errors to their fields', () => {
    const errors: ErrorDetails[] = [
      { field: 'spec.githubEnterprise.appID', detail: 'Invalid App ID', type: 'FieldValueInvalid' },
      { field: 'spec.githubEnterprise.installationID', detail: 'Invalid Installation ID', type: 'FieldValueInvalid' },
    ];

    expect(getConnectionFormErrors(errors)).toEqual([
      ['appID', { message: 'Invalid App ID' }],
      ['installationID', { message: 'Invalid Installation ID' }],
    ]);
  });

  it('still maps plain GitHub appID errors', () => {
    const errors: ErrorDetails[] = [
      { field: 'spec.github.appID', detail: 'Invalid App ID', type: 'FieldValueInvalid' },
    ];

    expect(getConnectionFormErrors(errors)).toEqual([['appID', { message: 'Invalid App ID' }]]);
  });
});

describe('source repository errors', () => {
  const errors: ErrorDetails[] = [
    { field: 'spec.source.url', detail: 'source URL must use https://', type: 'FieldValueInvalid' },
    { field: 'spec.source.auth.type', detail: 'unsupported auth type', type: 'FieldValueNotSupported' },
    { field: 'spec.source.allow[1]', detail: 'group is required', type: 'FieldValueRequired' },
    { field: 'spec.source.tls.caBundle', detail: 'no valid certificates', type: 'FieldValueInvalid' },
    { field: 'spec.connection.name', detail: 'connection is required', type: 'FieldValueRequired' },
    { field: 'secure.token', detail: 'token is not allowed', type: 'FieldValueForbidden' },
    { field: 'spec.workflows', detail: 'the source does not allow edits', type: 'FieldValueForbidden' },
  ];

  it('maps them to the wizard repository fields', () => {
    expect(getFormErrors(errors)).toEqual([
      ['repository.source.url', { message: 'source URL must use https://' }],
      ['repository.source.auth.type', { message: 'unsupported auth type' }],
      ['repository.source.allow', { message: 'group is required' }],
      ['repository.source.tls.caBundle', { message: 'no valid certificates' }],
      ['repository.connectionName', { message: 'connection is required' }],
      ['repository.token', { message: 'token is not allowed' }],
      ['repository.readOnly', { message: 'the source does not allow edits' }],
    ]);
  });

  it('maps them to the config form fields', () => {
    expect(getConfigFormErrors(errors)).toEqual([
      ['source.url', { message: 'source URL must use https://' }],
      ['source.auth.type', { message: 'unsupported auth type' }],
      ['source.allow', { message: 'group is required' }],
      ['source.tls.caBundle', { message: 'no valid certificates' }],
      ['connectionName', { message: 'connection is required' }],
      ['token', { message: 'token is not allowed' }],
      ['readOnly', { message: 'the source does not allow edits' }],
    ]);
  });
});

describe('source connection errors', () => {
  it('maps the token endpoint, client ID and client secret errors', () => {
    const errors: ErrorDetails[] = [
      { field: 'spec.source.tokenURL', detail: 'token URL is required', type: 'FieldValueRequired' },
      { field: 'spec.oauth.clientID', detail: 'client ID is required', type: 'FieldValueRequired' },
      { field: 'secure.clientSecret', detail: 'client secret is required', type: 'FieldValueRequired' },
    ];

    expect(getConnectionFormErrors(errors)).toEqual([
      ['tokenURL', { message: 'token URL is required' }],
      ['clientID', { message: 'client ID is required' }],
      ['clientSecret', { message: 'client secret is required' }],
    ]);
  });
});
