import { PluginExtensionPoints } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import { getExploreExtensionConfigs } from './getExploreExtensionConfigs';
jest.mock('app/core/services/context_srv');
const contextSrvMock = jest.mocked(contextSrv);
describe('getExploreExtensionConfigs', () => {
    describe('configured items returned', () => {
        it('should return array with core extensions added in explore', () => {
            const extensions = getExploreExtensionConfigs();
            expect(extensions).toEqual([
                {
                    type: 'link',
                    title: 'Add to dashboard',
                    description: 'Use the query and panel from explore and create/add it to a dashboard',
                    extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
                    icon: 'apps',
                    configure: expect.any(Function),
                    onClick: expect.any(Function),
                    category: 'Dashboards',
                },
                {
                    type: 'link',
                    title: 'Add correlation',
                    description: 'Create a correlation from this query',
                    extensionPointId: PluginExtensionPoints.ExploreToolbarAction,
                    icon: 'link',
                    configure: expect.any(Function),
                    onClick: expect.any(Function),
                },
            ]);
        });
    });
    describe('configure function for "add to dashboard" extension', () => {
        afterEach(() => contextSrvMock.hasPermission.mockRestore());
        it('should return undefined if insufficient permissions', () => {
            var _a;
            contextSrvMock.hasPermission.mockReturnValue(false);
            const extensions = getExploreExtensionConfigs();
            const [extension] = extensions;
            expect((_a = extension === null || extension === void 0 ? void 0 : extension.configure) === null || _a === void 0 ? void 0 : _a.call(extension)).toBeUndefined();
        });
        it('should return empty object if sufficient permissions', () => {
            var _a;
            contextSrvMock.hasPermission.mockReturnValue(true);
            const extensions = getExploreExtensionConfigs();
            const [extension] = extensions;
            expect((_a = extension === null || extension === void 0 ? void 0 : extension.configure) === null || _a === void 0 ? void 0 : _a.call(extension)).toEqual({});
        });
    });
});
//# sourceMappingURL=getExploreExtensionConfigs.test.js.map