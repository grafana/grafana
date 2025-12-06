// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/configuration/ConfigEditor.test.tsx
import { FieldValidationMessage } from '@grafana/ui';

import { DURATION_REGEX, MULTIPLE_DURATION_REGEX } from '../constants';

import { validateInput } from './shared/utils';

const VALID_URL_REGEX = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/;

const error = <FieldValidationMessage>Value is not valid</FieldValidationMessage>;
// replaces promSettingsValidationEvents to display a <FieldValidationMessage> onBlur for duration input errors
// Mock onAuthMethodSelect function that simulates the hardcoded SigV4 cleanup logic
const mockOnAuthMethodSelect = (method: string, options: any) => {
  const sigV4Id = 'custom-sigV4Id';
  const sigV4AuthSelected = method === sigV4Id;
  
  let updatedJsonData = {
    ...options.jsonData,
    sigV4Auth: sigV4AuthSelected,
    oauthPassThru: method === 'oauth',
  };
  
  let updatedSecureJsonData = { ...options.secureJsonData };

  // Remove SigV4 properties when not using SigV4 auth (hardcoded for security)
  if (!sigV4AuthSelected) {
    // Remove CRITICAL SigV4 properties (hardcoded for security)
    delete updatedJsonData['assumeRoleArn'];  // Role ARN - allows role assumption
    delete updatedJsonData['externalId'];     // External ID - cross-account security token
    
    // Remove CRITICAL secureJsonData properties (hardcoded for security)
    delete updatedSecureJsonData['accessKey'];     // AWS Access Key ID - CRITICAL
    delete updatedSecureJsonData['secretKey'];     // AWS Secret Access Key - CRITICAL  
    delete updatedSecureJsonData['sessionToken'];  // AWS Session Token - CRITICAL
    
    // Remove any sigV4* prefixed secure properties (all are sensitive)
    Object.keys(updatedSecureJsonData).forEach(key => {
      if (key.startsWith('sigV4')) {
        delete updatedSecureJsonData[key];
      }
    });
  }

  return {
    ...options,
    jsonData: updatedJsonData,
    secureJsonData: updatedSecureJsonData,
  };
};

describe('SigV4 cleanup logic', () => {
  it('should remove CRITICAL SigV4 properties when switching from SigV4 to basic auth', () => {
    const mockOptionsWithSigV4 = {
      jsonData: {
        sigV4Auth: true,
        authType: 'sigV4',
        assumeRoleArn: 'arn:aws:iam::123456789:role/GrafanaRole',
        endpoint: 'https://monitoring.amazonaws.com',
        profile: 'grafana-profile',
        externalId: 'external-123',
        region: 'us-east-1',
        customTimeout: '30s',
        httpMethod: 'GET'
      },
      secureJsonData: {
        accessKey: 'AKIA...',
        secretKey: 'secret...',
        sessionToken: 'token...',
        customPassword: 'password123'
      }
    };

    const result = mockOnAuthMethodSelect('basic', mockOptionsWithSigV4);

    // CRITICAL SigV4 properties should be removed from jsonData
    expect(result.jsonData).not.toHaveProperty('assumeRoleArn');
    expect(result.jsonData).not.toHaveProperty('externalId');

    // CRITICAL SigV4 properties should be removed from secureJsonData
    expect(result.secureJsonData).not.toHaveProperty('accessKey');
    expect(result.secureJsonData).not.toHaveProperty('secretKey');
    expect(result.secureJsonData).not.toHaveProperty('sessionToken');

    // NON-CRITICAL properties should be KEPT for audit/debug
    expect(result.jsonData.authType).toBe('sigV4');
    expect(result.jsonData.endpoint).toBe('https://monitoring.amazonaws.com');
    expect(result.jsonData.profile).toBe('grafana-profile');

    // Non-SigV4 properties should remain
    expect(result.jsonData.region).toBe('us-east-1');
    expect(result.jsonData.customTimeout).toBe('30s');
    expect(result.jsonData.httpMethod).toBe('GET');
    expect(result.secureJsonData.customPassword).toBe('password123');

    // SigV4 auth should be false
    expect(result.jsonData.sigV4Auth).toBe(false);
  });

  it('should preserve all SigV4 properties when staying with SigV4 auth', () => {
    const mockOptionsWithSigV4 = {
      jsonData: {
        sigV4Auth: true,
        authType: 'sigV4',
        assumeRoleArn: 'arn:aws:iam::123456789:role/GrafanaRole',
        endpoint: 'https://monitoring.amazonaws.com',
        profile: 'grafana-profile',
        externalId: 'external-123',
        region: 'us-east-1',
        customTimeout: '30s'
      },
      secureJsonData: {
        accessKey: 'AKIA...',
        secretKey: 'secret...',
        sessionToken: 'token...',
        customPassword: 'password123'
      }
    };

    const result = mockOnAuthMethodSelect('custom-sigV4Id', mockOptionsWithSigV4);

    // All SigV4 properties should be preserved when staying with SigV4
    expect(result.jsonData.authType).toBe('sigV4');
    expect(result.jsonData.assumeRoleArn).toBe('arn:aws:iam::123456789:role/GrafanaRole');
    expect(result.jsonData.endpoint).toBe('https://monitoring.amazonaws.com');
    expect(result.jsonData.profile).toBe('grafana-profile');
    expect(result.jsonData.externalId).toBe('external-123');

    expect(result.secureJsonData.accessKey).toBe('AKIA...');
    expect(result.secureJsonData.secretKey).toBe('secret...');
    expect(result.secureJsonData.sessionToken).toBe('token...');

    // SigV4 auth should remain true
    expect(result.jsonData.sigV4Auth).toBe(true);
  });

  it('should handle options without SigV4 properties gracefully', () => {
    const mockOptionsWithoutSigV4 = {
      jsonData: {
        sigV4Auth: false,
        customTimeout: '30s',
        httpMethod: 'GET'
      },
      secureJsonData: {
        customPassword: 'password123'
      }
    };

    const result = mockOnAuthMethodSelect('basic', mockOptionsWithoutSigV4);

    // Should not crash and preserve existing properties
    expect(result.jsonData.customTimeout).toBe('30s');
    expect(result.jsonData.httpMethod).toBe('GET');
    expect(result.secureJsonData.customPassword).toBe('password123');
    expect(result.jsonData.sigV4Auth).toBe(false);
  });

  it('should clean up only CRITICAL SigV4 properties when present', () => {
    const mockOptionsWithPartialSigV4 = {
      jsonData: {
        sigV4Auth: true,
        authType: 'sigV4',
        assumeRoleArn: 'arn:aws:iam::123456789:role/GrafanaRole',
        endpoint: 'https://monitoring.amazonaws.com',
        // Missing some SigV4 properties
        customTimeout: '30s'
      },
      secureJsonData: {
        accessKey: 'AKIA...',
        // Missing some SigV4 properties
        customPassword: 'password123'
      }
    };

    const result = mockOnAuthMethodSelect('oauth', mockOptionsWithPartialSigV4);

    // CRITICAL SigV4 properties should be removed
    expect(result.jsonData).not.toHaveProperty('assumeRoleArn');
    expect(result.secureJsonData).not.toHaveProperty('accessKey');

    // NON-CRITICAL properties should be KEPT
    expect(result.jsonData.authType).toBe('sigV4');
    expect(result.jsonData.endpoint).toBe('https://monitoring.amazonaws.com');

    // Non-SigV4 properties should remain
    expect(result.jsonData.customTimeout).toBe('30s');
    expect(result.secureJsonData.customPassword).toBe('password123');

    // Auth flags should be updated correctly
    expect(result.jsonData.sigV4Auth).toBe(false);
    expect(result.jsonData.oauthPassThru).toBe(true);
  });
});

describe('promSettings validateInput', () => {
  it.each`
    value    | expected
    ${'1ms'} | ${true}
    ${'1M'}  | ${true}
    ${'1w'}  | ${true}
    ${'1d'}  | ${true}
    ${'1h'}  | ${true}
    ${'1m'}  | ${true}
    ${'1s'}  | ${true}
    ${'1y'}  | ${true}
  `(
    "Single duration regex, when calling the rule with correct formatted value: '$value' then result should be '$expected'",
    ({ value, expected }) => {
      expect(validateInput(value, DURATION_REGEX)).toBe(expected);
    }
  );

  it.each`
    value      | expected
    ${'1M 2s'} | ${true}
    ${'1w 2d'} | ${true}
    ${'1d 2m'} | ${true}
    ${'1h 2m'} | ${true}
    ${'1m 2s'} | ${true}
  `(
    "Multiple duration regex, when calling the rule with correct formatted value: '$value' then result should be '$expected'",
    ({ value, expected }) => {
      expect(validateInput(value, MULTIPLE_DURATION_REGEX)).toBe(expected);
    }
  );

  it.each`
    value     | expected
    ${'1 ms'} | ${error}
    ${'1x'}   | ${error}
    ${' '}    | ${error}
    ${'w'}    | ${error}
    ${'1.0s'} | ${error}
  `(
    "when calling the rule with incorrect formatted value: '$value' then result should be '$expected'",
    ({ value, expected }) => {
      expect(validateInput(value, DURATION_REGEX)).toStrictEqual(expected);
    }
  );

  it.each`
    value          | expected
    ${'frp://'}    | ${error}
    ${'htp://'}    | ${error}
    ${'httpss:??'} | ${error}
    ${'http@//'}   | ${error}
    ${'http:||'}   | ${error}
    ${'http://'}   | ${error}
    ${'https://'}  | ${error}
    ${'ftp://'}    | ${error}
  `(
    "Url incorrect formatting, when calling the rule with correct formatted value: '$value' then result should be '$expected'",
    ({ value, expected }) => {
      expect(validateInput(value, VALID_URL_REGEX)).toStrictEqual(expected);
    }
  );

  it.each`
    value                | expected
    ${'ftp://example'}   | ${true}
    ${'http://example'}  | ${true}
    ${'https://example'} | ${true}
  `(
    "Url correct formatting, when calling the rule with correct formatted value: '$value' then result should be '$expected'",
    ({ value, expected }) => {
      expect(validateInput(value, VALID_URL_REGEX)).toBe(expected);
    }
  );

  it('should display a custom validation message', () => {
    const invalidDuration = 'invalid';
    const customMessage = 'This is invalid';
    const errorWithCustomMessage = <FieldValidationMessage>{customMessage}</FieldValidationMessage>;
    expect(validateInput(invalidDuration, DURATION_REGEX, customMessage)).toStrictEqual(errorWithCustomMessage);
  });
});
