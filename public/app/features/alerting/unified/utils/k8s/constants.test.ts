import { USER_DEFINED_TREE_NAME } from '@grafana/alerting';

import { ROOT_ROUTE_NAME } from './constants';

describe('ROOT_ROUTE_NAME', () => {
  it('is the single-sourced user-defined send name', () => {
    expect(ROOT_ROUTE_NAME).toBe('user-defined');
    expect(ROOT_ROUTE_NAME).toBe(USER_DEFINED_TREE_NAME);
  });
});
