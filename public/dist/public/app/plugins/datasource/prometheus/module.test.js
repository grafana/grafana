import { plugin as PrometheusDatasourcePlugin } from './module';
import { ANNOTATION_QUERY_STEP_DEFAULT } from './datasource';
describe('module', function () {
    it('should have metrics query field in panels and Explore', function () {
        expect(PrometheusDatasourcePlugin.components.ExploreMetricsQueryField).toBeDefined();
        expect(PrometheusDatasourcePlugin.components.QueryEditor).toBeDefined();
    });
    it('should have stepDefaultValuePlaceholder set in annotations ctrl', function () {
        expect(PrometheusDatasourcePlugin.components.AnnotationsQueryCtrl).toBeDefined();
        var annotationsCtrl = new PrometheusDatasourcePlugin.components.AnnotationsQueryCtrl();
        expect(annotationsCtrl.stepDefaultValuePlaceholder).toEqual(ANNOTATION_QUERY_STEP_DEFAULT);
    });
});
//# sourceMappingURL=module.test.js.map