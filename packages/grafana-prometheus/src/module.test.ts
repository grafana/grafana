// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/module.test.ts
import { plugin as PrometheusDatasourcePlugin } from './module';

describe('module', () => {
  it('should have metrics query field in panels and Explore', () => {
    expect(PrometheusDatasourcePlugin.components.QueryEditor).toBeDefined();
  });
});
