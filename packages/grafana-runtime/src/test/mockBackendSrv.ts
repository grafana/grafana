import { type BackendSrv } from '../services/backendSrv';

/**
 * Returns a BackendSrv whose methods are all jest.fn() mocks. Pass `overrides` for the methods
 * a test needs to answer, so tests don't have to cast a partial object to BackendSrv.
 */
export function mockBackendSrv(overrides: Partial<BackendSrv> = {}): BackendSrv {
  return {
    get: jest.fn(),
    delete: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
    request: jest.fn(),
    datasourceRequest: jest.fn(),
    fetch: jest.fn(),
    chunked: jest.fn(),
    ...overrides,
  };
}
