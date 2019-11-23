import { plugin as PrometheusDatasourcePlugin } from '../module';

describe('module', () => {
  it('should have metrics query field in panels and Explore', () => {
    expect(PrometheusDatasourcePlugin.components.ExploreMetricsQueryField).toBeDefined();
    expect(PrometheusDatasourcePlugin.components.QueryEditor).toBeDefined();
  });
});
