import { findNewName, nameExits } from './actions';
import { getMockPlugin, getMockPlugins } from '../../plugins/__mocks__/pluginMocks';
describe('Name exists', function () {
    var plugins = getMockPlugins(5);
    it('should be true', function () {
        var name = 'pretty cool plugin-1';
        expect(nameExits(plugins, name)).toEqual(true);
    });
    it('should be false', function () {
        var name = 'pretty cool plugin-6';
        expect(nameExits(plugins, name));
    });
});
describe('Find new name', function () {
    it('should create a new name', function () {
        var plugins = getMockPlugins(5);
        var name = 'pretty cool plugin-1';
        expect(findNewName(plugins, name)).toEqual('pretty cool plugin-6');
    });
    it('should create new name without suffix', function () {
        var plugin = getMockPlugin();
        plugin.name = 'prometheus';
        var plugins = [plugin];
        var name = 'prometheus';
        expect(findNewName(plugins, name)).toEqual('prometheus-1');
    });
    it('should handle names that end with -', function () {
        var plugin = getMockPlugin();
        var plugins = [plugin];
        var name = 'pretty cool plugin-';
        expect(findNewName(plugins, name)).toEqual('pretty cool plugin-');
    });
});
//# sourceMappingURL=actions.test.js.map