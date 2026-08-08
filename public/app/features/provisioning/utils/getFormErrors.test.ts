import { type ErrorDetails } from 'app/api/clients/provisioning/v0alpha1';

import { getConfigFormErrors, getConnectionFormErrors, getFormErrors } from './getFormErrors';

describe('Pure Git request limit errors', () => {
  const errors: ErrorDetails[] = [
    {
      field: 'spec.git.requestLimits.maxConcurrent',
      detail: 'Must be zero or greater',
      type: 'FieldValueInvalid',
    },
  ];

  it('maps request limit errors to the wizard form', () => {
    expect(getFormErrors(errors)).toEqual([
      ['repository.requestLimits.maxConcurrent', { message: 'Must be zero or greater' }],
    ]);
  });

  it('maps request limit errors to the configuration form', () => {
    expect(getConfigFormErrors(errors)).toEqual([
      ['requestLimits.maxConcurrent', { message: 'Must be zero or greater' }],
    ]);
  });
});

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
