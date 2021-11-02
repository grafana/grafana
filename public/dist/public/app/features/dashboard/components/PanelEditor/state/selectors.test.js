import { getPanelEditorTabs } from './selectors';
import { PanelEditorTabId } from '../types';
import { updateConfig } from '../../../../../core/config';
describe('getPanelEditorTabs selector', function () {
    it('return no tabs when no plugin provided', function () {
        expect(getPanelEditorTabs()).toEqual([]);
    });
    it('return no tabs when plugin do not support queries', function () {
        expect(getPanelEditorTabs(undefined, { meta: { skipDataQuery: true } })).toEqual([]);
    });
    it('marks tab as active when tab param provided', function () {
        expect(getPanelEditorTabs('transform', { meta: { skipDataQuery: false } })).toMatchInlineSnapshot("\n      Array [\n        Object {\n          \"active\": false,\n          \"icon\": \"database\",\n          \"id\": \"query\",\n          \"text\": \"Query\",\n        },\n        Object {\n          \"active\": true,\n          \"icon\": \"process\",\n          \"id\": \"transform\",\n          \"text\": \"Transform\",\n        },\n      ]\n    ");
    });
    describe('alerts tab', function () {
        describe('when alerting enabled', function () {
            beforeAll(function () {
                updateConfig({
                    alertingEnabled: true,
                });
            });
            it('returns Alerts tab for graph panel', function () {
                var tabs = getPanelEditorTabs(undefined, {
                    meta: {
                        id: 'graph',
                    },
                });
                expect(tabs.length).toEqual(3);
                expect(tabs[2].id).toEqual(PanelEditorTabId.Alert);
            });
            it('does not returns tab for panel other than graph', function () {
                var tabs = getPanelEditorTabs(undefined, {
                    meta: {
                        id: 'table',
                    },
                });
                expect(tabs.length).toEqual(2);
                expect(tabs[1].id).toEqual(PanelEditorTabId.Transform);
            });
        });
        describe('when alerting disabled', function () {
            beforeAll(function () {
                updateConfig({
                    alertingEnabled: false,
                });
            });
            it('does not return Alerts tab', function () {
                var tabs = getPanelEditorTabs(undefined, {
                    meta: {
                        id: 'graph',
                    },
                });
                expect(tabs.length).toEqual(2);
                expect(tabs[1].id).toEqual(PanelEditorTabId.Transform);
            });
        });
    });
});
//# sourceMappingURL=selectors.test.js.map