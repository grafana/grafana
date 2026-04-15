import { type DataSourceConfigValidationAPI } from '@grafana/data';

/**
 * Creates a mock ValidationAPI for use in tests. Captures the registered
 * validator so tests can invoke it directly and assert on inline error display.
 */
export const createMockValidation = () => {
  let registeredValidator: (() => boolean | Promise<boolean>) | null = null;
  const api: DataSourceConfigValidationAPI & { runValidator: () => boolean | Promise<boolean> } = {
    registerValidation: jest.fn((fn) => {
      registeredValidator = fn;
      return () => {};
    }),
    validate: jest.fn(async () => true),
    isValid: jest.fn(() => true),
    getErrors: jest.fn(() => ({})),
    setError: jest.fn(),
    clearError: jest.fn(),
    runValidator: () => registeredValidator?.() ?? true,
  };
  return api;
};

/**
 * Creates a set of test props for the InfluxDB V2 config page for use in tests.
 * This function allows you to override default properties for specific test cases.
 */
export const createTestProps = (overrides: { options?: object; mocks?: object }) => ({
  options: {
    access: 'proxy',
    basicAuth: false,
    basicAuthUser: '',
    database: '',
    id: 1,
    isDefault: false,
    jsonData: {
      httpMode: 'POST',
      timeInterval: '5',
    },
    name: 'InfluxDB',
    orgId: 1,
    readOnly: false,
    secureJsonFields: {},
    type: 'influxdb',
    typeLogoUrl: '',
    typeName: 'Influx',
    uid: 'z',
    url: '',
    user: '',
    version: 1,
    withCredentials: false,
    ...overrides.options,
  },
  onOptionsChange: jest.fn(),
  ...overrides.mocks,
});
