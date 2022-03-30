import '@grafana/runtime';
import { fetchAnnotations } from './annotations';

const get = jest.fn();

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({ get }),
}));

describe('annotations', () => {
  beforeEach(() => get.mockClear());

  it('should fetch annotation for an alertId', () => {
    const ALERT_ID = 'abc123';
    fetchAnnotations(ALERT_ID);
    expect(get).toBeCalledWith('/api/annotations', { alertId: ALERT_ID });
  });
});
