import { Flows } from '@grafana/e2e';

describe('Login', () => {
  it('should pass', () => {
    Flows.login('admin', 'admin');
  });
});
