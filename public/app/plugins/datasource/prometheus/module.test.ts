import { plugin as PrometheusDatasourcePlugin } from './module';
import { ANNOTATION_QUERY_STEP_DEFAULT } from './datasource';

describe('module', () => {
  it('should have metrics query field in panels and Explore', () => {
    expect(PrometheusDatasourcePlugin.components.ExploreMetricsQueryField).toBeDefined();
    expect(PrometheusDatasourcePlugin.components.QueryEditor).toBeDefined();
  });
  it('should have stepDefaultValuePlaceholder set in annotations ctrl', () => {
    expect(PrometheusDatasourcePlugin.components.AnnotationsQueryCtrl).toBeDefined();
    const annotationsCtrl = new PrometheusDatasourcePlugin.components.AnnotationsQueryCtrl();
    expect(annotationsCtrl.stepDefaultValuePlaceholder).toEqual(ANNOTATION_QUERY_STEP_DEFAULT);
  });
});
