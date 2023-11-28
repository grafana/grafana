import { defaultDashboardCursorSync, defaultVariableModel, } from '@grafana/schema';
import { DashboardModel } from '../DashboardModel';
export function createDashboardModelFixture(dashboardInput = {}, meta, getVariablesFromState) {
    const dashboardJson = Object.assign({ editable: true, graphTooltip: defaultDashboardCursorSync, schemaVersion: 1, timezone: '' }, dashboardInput);
    return new DashboardModel(dashboardJson, meta, { getVariablesFromState });
}
export function createPanelSaveModel(panelInput = {}) {
    return Object.assign({ type: 'timeseries' }, panelInput);
}
export function createAnnotationJSONFixture(annotationInput) {
    // @ts-expect-error
    return Object.assign({ datasource: {
            type: 'foo',
            uid: 'bar',
        }, enable: true, type: 'anno' }, annotationInput);
}
export function createVariableJSONFixture(annotationInput) {
    return Object.assign(Object.assign(Object.assign({}, defaultVariableModel), { name: 'foo.variable', type: 'constant' }), annotationInput);
}
//# sourceMappingURL=dashboardFixtures.js.map