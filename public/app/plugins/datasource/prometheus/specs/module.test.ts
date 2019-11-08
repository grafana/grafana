import { plugin as PrometheusDatasourcePlugin } from '../module';

describe('module', () => {
  it('should have an Explore metrics uqery field', () => {
    expect(PrometheusDatasourcePlugin).toBeTruthy();
    expect(PrometheusDatasourcePlugin.components.ExploreMetricsQueryField).toBeDefined();
  });
});
