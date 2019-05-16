const backendSrv = {
  get: jest.fn(),
  getDashboard: jest.fn(),
  getDashboardByUid: jest.fn(),
  getFolderByUid: jest.fn(),
  post: jest.fn(),
  resolveCancelerIfExists: jest.fn(),
};

export function getBackendSrv() {
  return backendSrv;
}
