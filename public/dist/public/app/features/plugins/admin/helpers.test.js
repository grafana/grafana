import { __assign } from "tslib";
import { getLocalPluginMock, getRemotePluginMock, getCatalogPluginMock } from './__mocks__';
import { PluginSignatureStatus, PluginSignatureType, PluginType } from '@grafana/data';
import { mapToCatalogPlugin, mapRemoteToCatalog, mapLocalToCatalog, mergeLocalAndRemote, mergeLocalsAndRemotes, sortPlugins, Sorters, } from './helpers';
describe('Plugins/Helpers', function () {
    var remotePlugin;
    var localPlugin;
    beforeEach(function () {
        remotePlugin = getRemotePluginMock();
        localPlugin = getLocalPluginMock();
    });
    describe('mergeLocalsAndRemotes()', function () {
        var localPlugins = [
            getLocalPluginMock({ id: 'plugin-1' }),
            getLocalPluginMock({ id: 'plugin-2' }),
            getLocalPluginMock({ id: 'plugin-3' }), // only on local
        ];
        var remotePlugins = [
            getRemotePluginMock({ slug: 'plugin-1' }),
            getRemotePluginMock({ slug: 'plugin-2' }),
            getRemotePluginMock({ slug: 'plugin-4' }), // only on remote
        ];
        test('adds all available plugins only once', function () {
            var merged = mergeLocalsAndRemotes(localPlugins, remotePlugins);
            var mergedIds = merged.map(function (_a) {
                var id = _a.id;
                return id;
            });
            expect(merged.length).toBe(4);
            expect(mergedIds).toContain('plugin-1');
            expect(mergedIds).toContain('plugin-2');
            expect(mergedIds).toContain('plugin-3');
            expect(mergedIds).toContain('plugin-4');
        });
        test('merges all plugins with their counterpart (if available)', function () {
            var merged = mergeLocalsAndRemotes(localPlugins, remotePlugins);
            var findMerged = function (mergedId) { return merged.find(function (_a) {
                var id = _a.id;
                return id === mergedId;
            }); };
            // Both local & remote counterparts
            expect(findMerged('plugin-1')).toEqual(mergeLocalAndRemote(getLocalPluginMock({ id: 'plugin-1' }), getRemotePluginMock({ slug: 'plugin-1' })));
            expect(findMerged('plugin-2')).toEqual(mergeLocalAndRemote(getLocalPluginMock({ id: 'plugin-2' }), getRemotePluginMock({ slug: 'plugin-2' })));
            // Only local
            expect(findMerged('plugin-3')).toEqual(mergeLocalAndRemote(getLocalPluginMock({ id: 'plugin-3' })));
            // Only remote
            expect(findMerged('plugin-4')).toEqual(mergeLocalAndRemote(undefined, getRemotePluginMock({ slug: 'plugin-4' })));
        });
    });
    describe('mergeLocalAndRemote()', function () {
        test('merges using mapRemoteToCatalog() if there is only a remote version', function () {
            expect(mergeLocalAndRemote(undefined, remotePlugin)).toEqual(mapRemoteToCatalog(remotePlugin));
        });
        test('merges using mapLocalToCatalog() if there is only a local version', function () {
            expect(mergeLocalAndRemote(localPlugin)).toEqual(mapLocalToCatalog(localPlugin));
        });
        test('merges using mapToCatalogPlugin() if there is both a remote and a local version', function () {
            expect(mergeLocalAndRemote(localPlugin, remotePlugin)).toEqual(mapToCatalogPlugin(localPlugin, remotePlugin));
        });
    });
    describe('mapRemoteToCatalog()', function () {
        test('maps the remote response (GCOM /api/plugins/<id>) to PluginCatalog', function () {
            expect(mapRemoteToCatalog(remotePlugin)).toEqual({
                description: 'Zabbix plugin for Grafana',
                downloads: 33645089,
                hasUpdate: false,
                id: 'alexanderzobnin-zabbix-app',
                info: {
                    logos: {
                        large: 'https://grafana.com/api/plugins/alexanderzobnin-zabbix-app/versions/4.1.5/logos/large',
                        small: 'https://grafana.com/api/plugins/alexanderzobnin-zabbix-app/versions/4.1.5/logos/small',
                    },
                },
                error: undefined,
                isCore: false,
                isDev: false,
                isDisabled: false,
                isEnterprise: false,
                isInstalled: false,
                name: 'Zabbix',
                orgName: 'Alexander Zobnin',
                popularity: 0.2111,
                publishedAt: '2016-04-06T20:23:41.000Z',
                signature: 'valid',
                type: 'app',
                updatedAt: '2021-05-18T14:53:01.000Z',
                version: '4.1.5',
            });
        });
        test('adds the correct signature enum', function () {
            var pluginWithoutSignature = __assign(__assign({}, remotePlugin), { signatureType: '', versionSignatureType: '' });
            // With only "signatureType" -> valid
            var pluginWithSignature1 = __assign(__assign({}, remotePlugin), { signatureType: PluginSignatureType.commercial });
            // With only "versionSignatureType" -> valid
            var pluginWithSignature2 = __assign(__assign({}, remotePlugin), { versionSignatureType: PluginSignatureType.core });
            expect(mapRemoteToCatalog(pluginWithoutSignature).signature).toBe(PluginSignatureStatus.missing);
            expect(mapRemoteToCatalog(pluginWithSignature1).signature).toBe(PluginSignatureStatus.valid);
            expect(mapRemoteToCatalog(pluginWithSignature2).signature).toBe(PluginSignatureStatus.valid);
        });
        test('adds an "isEnterprise" field', function () {
            var enterprisePlugin = __assign(__assign({}, remotePlugin), { status: 'enterprise' });
            var notEnterprisePlugin = __assign(__assign({}, remotePlugin), { status: 'unknown' });
            expect(mapRemoteToCatalog(enterprisePlugin).isEnterprise).toBe(true);
            expect(mapRemoteToCatalog(notEnterprisePlugin).isEnterprise).toBe(false);
        });
        test('adds an "isCore" field', function () {
            var corePlugin = __assign(__assign({}, remotePlugin), { internal: true });
            var notCorePlugin = __assign(__assign({}, remotePlugin), { internal: false });
            expect(mapRemoteToCatalog(corePlugin).isCore).toBe(true);
            expect(mapRemoteToCatalog(notCorePlugin).isCore).toBe(false);
        });
    });
    describe('mapLocalToCatalog()', function () {
        test('maps local response to PluginCatalog', function () {
            expect(mapLocalToCatalog(localPlugin)).toEqual({
                description: 'Zabbix plugin for Grafana',
                downloads: 0,
                id: 'alexanderzobnin-zabbix-app',
                info: {
                    logos: {
                        large: 'public/plugins/alexanderzobnin-zabbix-app/img/icn-zabbix-app.svg',
                        small: 'public/plugins/alexanderzobnin-zabbix-app/img/icn-zabbix-app.svg',
                    },
                },
                error: undefined,
                hasUpdate: false,
                isCore: false,
                isDev: false,
                isDisabled: false,
                isEnterprise: false,
                isInstalled: true,
                name: 'Zabbix',
                orgName: 'Alexander Zobnin',
                popularity: 0,
                publishedAt: '',
                signature: 'valid',
                signatureOrg: 'Alexander Zobnin',
                signatureType: 'community',
                type: 'app',
                updatedAt: '2021-08-25',
                version: '4.2.2',
            });
        });
        test('isCore if signature is internal', function () {
            var pluginWithoutInternalSignature = __assign({}, localPlugin);
            var pluginWithInternalSignature = __assign(__assign({}, localPlugin), { signature: 'internal' });
            expect(mapLocalToCatalog(pluginWithoutInternalSignature).isCore).toBe(false);
            expect(mapLocalToCatalog(pluginWithInternalSignature).isCore).toBe(true);
        });
        test('isDev if local.dev', function () {
            var pluginWithoutDev = __assign(__assign({}, localPlugin), { dev: false });
            var pluginWithDev = __assign(__assign({}, localPlugin), { dev: true });
            expect(mapLocalToCatalog(pluginWithoutDev).isDev).toBe(false);
            expect(mapLocalToCatalog(pluginWithDev).isDev).toBe(true);
        });
    });
    describe('mapToCatalogPlugin()', function () {
        test('merges local and remote plugin data correctly', function () {
            expect(mapToCatalogPlugin(localPlugin, remotePlugin)).toEqual({
                description: 'Zabbix plugin for Grafana',
                downloads: 33645089,
                hasUpdate: false,
                id: 'alexanderzobnin-zabbix-app',
                info: {
                    logos: {
                        small: 'https://grafana.com/api/plugins/alexanderzobnin-zabbix-app/versions/4.1.5/logos/small',
                        large: 'https://grafana.com/api/plugins/alexanderzobnin-zabbix-app/versions/4.1.5/logos/large',
                    },
                },
                error: undefined,
                isCore: false,
                isDev: false,
                isDisabled: false,
                isEnterprise: false,
                isInstalled: true,
                name: 'Zabbix',
                orgName: 'Alexander Zobnin',
                popularity: 0.2111,
                publishedAt: '2016-04-06T20:23:41.000Z',
                signature: 'valid',
                signatureOrg: 'Alexander Zobnin',
                signatureType: 'community',
                type: 'app',
                updatedAt: '2021-05-18T14:53:01.000Z',
                version: '4.1.5',
            });
        });
        test('`.description` - prefers the remote', function () {
            // Local & Remote
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { info: __assign(__assign({}, localPlugin.info), { description: 'Local description' }) }), __assign(__assign({}, remotePlugin), { description: 'Remote description' }))).toMatchObject({ description: 'Remote description' });
            // Remote only
            expect(mapToCatalogPlugin(undefined, __assign(__assign({}, remotePlugin), { description: 'Remote description' }))).toMatchObject({
                description: 'Remote description',
            });
            // Local only
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { info: __assign(__assign({}, localPlugin.info), { description: 'Local description' }) }))).toMatchObject({ description: 'Local description' });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ description: '' });
        });
        test('`.hasUpdate` - prefers the local', function () {
            // Local & Remote (only if the remote version is greater than the local one)
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { info: __assign(__assign({}, localPlugin.info), { version: '2.0.0' }) }), __assign(__assign({}, remotePlugin), { version: '2.1.0' }))).toMatchObject({ hasUpdate: true });
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { info: __assign(__assign({}, localPlugin.info), { version: '2.1.0' }) }), __assign(__assign({}, remotePlugin), { version: '2.1.0' }))).toMatchObject({ hasUpdate: false });
            // Remote only
            expect(mapToCatalogPlugin(undefined, __assign(__assign({}, remotePlugin), { version: '2.1.0' }))).toMatchObject({
                hasUpdate: false,
            });
            // Local only
            expect(mapToCatalogPlugin(__assign({}, localPlugin))).toMatchObject({ hasUpdate: false });
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { hasUpdate: true }))).toMatchObject({ hasUpdate: true });
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { info: __assign(__assign({}, localPlugin.info), { version: '2.1.0' }) }))).toMatchObject({
                hasUpdate: false,
            });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ hasUpdate: false });
        });
        test('`.downloads` - relies on the remote', function () {
            // Local & Remote
            expect(mapToCatalogPlugin(localPlugin, __assign(__assign({}, remotePlugin), { downloads: 99 }))).toMatchObject({ downloads: 99 });
            // Remote only
            expect(mapToCatalogPlugin(undefined, __assign(__assign({}, remotePlugin), { downloads: 99 }))).toMatchObject({ downloads: 99 });
            // Local only
            expect(mapToCatalogPlugin(localPlugin)).toMatchObject({ downloads: 0 });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ downloads: 0 });
        });
        test('`.isCore` - prefers the remote', function () {
            // Local & Remote
            expect(mapToCatalogPlugin(localPlugin, __assign(__assign({}, remotePlugin), { internal: true }))).toMatchObject({ isCore: true });
            // Remote only
            expect(mapToCatalogPlugin(undefined, __assign(__assign({}, remotePlugin), { internal: true }))).toMatchObject({ isCore: true });
            expect(mapToCatalogPlugin(undefined, __assign(__assign({}, remotePlugin), { internal: false }))).toMatchObject({ isCore: false });
            // Local only
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { signature: PluginSignatureStatus.internal }))).toMatchObject({
                isCore: true,
            });
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { signature: PluginSignatureStatus.valid }))).toMatchObject({
                isCore: false,
            });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ isCore: false });
        });
        test('`.isDev` - prefers the local', function () {
            // Local & Remote
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { dev: true }), remotePlugin)).toMatchObject({ isDev: true });
            // Remote only
            expect(mapToCatalogPlugin(undefined, remotePlugin)).toMatchObject({ isDev: false });
            // Local only
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { dev: true }), undefined)).toMatchObject({ isDev: true });
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { dev: undefined }), undefined)).toMatchObject({ isDev: false });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ isDev: false });
        });
        test('`.isEnterprise` - prefers the remote', function () {
            // Local & Remote
            expect(mapToCatalogPlugin(localPlugin, __assign(__assign({}, remotePlugin), { status: 'enterprise' }))).toMatchObject({
                isEnterprise: true,
            });
            expect(mapToCatalogPlugin(localPlugin, __assign(__assign({}, remotePlugin), { status: 'unknown' }))).toMatchObject({
                isEnterprise: false,
            });
            // Remote only
            expect(mapToCatalogPlugin(undefined, __assign(__assign({}, remotePlugin), { status: 'enterprise' }))).toMatchObject({
                isEnterprise: true,
            });
            // Local only
            expect(mapToCatalogPlugin(localPlugin)).toMatchObject({ isEnterprise: false });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ isEnterprise: false });
        });
        test('`.isInstalled` - prefers the local', function () {
            // Local & Remote
            expect(mapToCatalogPlugin(localPlugin, remotePlugin)).toMatchObject({ isInstalled: true });
            // Remote only
            expect(mapToCatalogPlugin(undefined, remotePlugin)).toMatchObject({ isInstalled: false });
            // Local only
            expect(mapToCatalogPlugin(localPlugin, undefined)).toMatchObject({ isInstalled: true });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ isInstalled: false });
        });
        test('`.name` - prefers the remote', function () {
            // Local & Remote
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { name: 'Local name' }), __assign(__assign({}, remotePlugin), { name: 'Remote name' }))).toMatchObject({ name: 'Remote name' });
            // Remote only
            expect(mapToCatalogPlugin(undefined, __assign(__assign({}, remotePlugin), { name: 'Remote name' }))).toMatchObject({
                name: 'Remote name',
            });
            // Local only
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { name: 'Local name' }))).toMatchObject({ name: 'Local name' });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ name: '' });
        });
        test('`.orgName` - prefers the remote', function () {
            // Local & Remote
            expect(mapToCatalogPlugin(localPlugin, __assign(__assign({}, remotePlugin), { orgName: 'Remote org' }))).toMatchObject({
                orgName: 'Remote org',
            });
            // Remote only
            expect(mapToCatalogPlugin(undefined, __assign(__assign({}, remotePlugin), { orgName: 'Remote org' }))).toMatchObject({
                orgName: 'Remote org',
            });
            // Local only
            expect(mapToCatalogPlugin(localPlugin)).toMatchObject({ orgName: 'Alexander Zobnin' });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ orgName: '' });
        });
        test('`.popularity` - prefers the remote', function () {
            // Local & Remote
            expect(mapToCatalogPlugin(localPlugin, __assign(__assign({}, remotePlugin), { popularity: 10 }))).toMatchObject({ popularity: 10 });
            // Remote only
            expect(mapToCatalogPlugin(undefined, __assign(__assign({}, remotePlugin), { popularity: 10 }))).toMatchObject({ popularity: 10 });
            // Local only
            expect(mapToCatalogPlugin(localPlugin)).toMatchObject({ popularity: 0 });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ popularity: 0 });
        });
        test('`.publishedAt` - prefers the remote', function () {
            // Local & Remote
            expect(mapToCatalogPlugin(localPlugin, __assign(__assign({}, remotePlugin), { createdAt: '2020-01-01' }))).toMatchObject({
                publishedAt: '2020-01-01',
            });
            // Remote only
            expect(mapToCatalogPlugin(undefined, __assign(__assign({}, remotePlugin), { createdAt: '2020-01-01' }))).toMatchObject({
                publishedAt: '2020-01-01',
            });
            // Local only
            expect(mapToCatalogPlugin(localPlugin)).toMatchObject({ publishedAt: '' });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ publishedAt: '' });
        });
        test('`.type` - prefers the remote', function () {
            // Local & Remote
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { type: PluginType.app }), __assign(__assign({}, remotePlugin), { typeCode: PluginType.datasource }))).toMatchObject({
                type: PluginType.datasource,
            });
            // Remote only
            expect(mapToCatalogPlugin(undefined, __assign(__assign({}, remotePlugin), { typeCode: PluginType.datasource }))).toMatchObject({
                type: PluginType.datasource,
            });
            // Local only
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { type: PluginType.app }))).toMatchObject({
                type: PluginType.app,
            });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ type: undefined });
        });
        test('`.signature` - prefers the local', function () {
            // Local & Remote
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { signature: PluginSignatureStatus.valid }), __assign(__assign({}, remotePlugin), { signatureType: '', versionSignatureType: '' }))).toMatchObject({
                signature: PluginSignatureStatus.valid,
            });
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { signature: PluginSignatureStatus.missing }), __assign(__assign({}, remotePlugin), { signatureType: PluginSignatureType.grafana, versionSignatureType: PluginSignatureType.grafana }))).toMatchObject({
                signature: PluginSignatureStatus.missing,
            });
            // Remote only
            expect(mapToCatalogPlugin(undefined, __assign(__assign({}, remotePlugin), { signatureType: PluginSignatureType.grafana }))).toMatchObject({
                signature: PluginSignatureStatus.valid,
            });
            expect(mapToCatalogPlugin(undefined, __assign(__assign({}, remotePlugin), { versionSignatureType: PluginSignatureType.grafana }))).toMatchObject({
                signature: PluginSignatureStatus.valid,
            });
            expect(mapToCatalogPlugin(undefined, __assign(__assign({}, remotePlugin), { signatureType: '', versionSignatureType: '' }))).toMatchObject({
                signature: PluginSignatureStatus.missing,
            });
            // Local only
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { signature: PluginSignatureStatus.valid }))).toMatchObject({
                signature: PluginSignatureStatus.valid,
            });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ signature: PluginSignatureStatus.missing });
        });
        test('`.signatureOrg` - prefers the local', function () {
            // Local & Remote
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { signatureOrg: 'Local Org' }), __assign(__assign({}, remotePlugin), { versionSignedByOrgName: 'Remote Org' }))).toMatchObject({
                signatureOrg: 'Local Org',
            });
            // Remote only
            expect(mapToCatalogPlugin(undefined, __assign(__assign({}, remotePlugin), { versionSignedByOrgName: 'Remote Org' }))).toMatchObject({
                signatureOrg: 'Remote Org',
            });
            // Local only
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { signatureOrg: 'Local Org' }))).toMatchObject({
                signatureOrg: 'Local Org',
            });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ signatureOrg: undefined });
        });
        test('`.signatureType` - prefers the local', function () {
            // Local & Remote
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { signatureType: PluginSignatureType.core }), __assign(__assign({}, remotePlugin), { signatureType: PluginSignatureType.grafana }))).toMatchObject({
                signatureType: PluginSignatureType.core,
            });
            // Remote only
            expect(mapToCatalogPlugin(undefined, __assign(__assign({}, remotePlugin), { versionSignatureType: PluginSignatureType.core, signatureType: PluginSignatureType.grafana }))).toMatchObject({
                signatureType: PluginSignatureType.core,
            });
            expect(mapToCatalogPlugin(undefined, __assign(__assign({}, remotePlugin), { versionSignatureType: '', signatureType: PluginSignatureType.grafana }))).toMatchObject({
                signatureType: PluginSignatureType.grafana,
            });
            // Local only
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { signatureType: PluginSignatureType.core }))).toMatchObject({
                signatureType: PluginSignatureType.core,
            });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ signatureType: undefined });
        });
        test('`.updatedAt` - prefers the remote', function () {
            // Local & Remote
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { info: __assign(__assign({}, localPlugin.info), { updated: '2019-01-01' }) }), __assign(__assign({}, remotePlugin), { updatedAt: '2020-01-01' }))).toMatchObject({
                updatedAt: '2020-01-01',
            });
            // Remote only
            expect(mapToCatalogPlugin(undefined, __assign(__assign({}, remotePlugin), { updatedAt: '2020-01-01' }))).toMatchObject({
                updatedAt: '2020-01-01',
            });
            // Local only
            expect(mapToCatalogPlugin(__assign(__assign({}, localPlugin), { info: __assign(__assign({}, localPlugin.info), { updated: '2019-01-01' }) }))).toMatchObject({
                updatedAt: '2019-01-01',
            });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ updatedAt: '' });
        });
    });
    describe('sortPlugins()', function () {
        test('should be possible to sort by `name` ASC', function () {
            var sorted = sortPlugins([
                getCatalogPluginMock({ id: 'zabbix', name: 'Zabbix' }),
                getCatalogPluginMock({ id: 'snowflake', name: 'Snowflake' }),
                getCatalogPluginMock({ id: 'jira', name: 'Jira' }),
                getCatalogPluginMock({ id: 'pie-chart', name: 'Pie Chart' }),
                getCatalogPluginMock({ id: 'cloud-watch', name: 'CloudWatch' }),
            ], Sorters.nameAsc);
            expect(sorted.map(function (_a) {
                var name = _a.name;
                return name;
            })).toEqual(['CloudWatch', 'Jira', 'Pie Chart', 'Snowflake', 'Zabbix']);
        });
        test('should be possible to sort by `name` DESC', function () {
            var sorted = sortPlugins([
                getCatalogPluginMock({ id: 'zabbix', name: 'Zabbix' }),
                getCatalogPluginMock({ id: 'snowflake', name: 'Snowflake' }),
                getCatalogPluginMock({ id: 'jira', name: 'Jira' }),
                getCatalogPluginMock({ id: 'pie-chart', name: 'Pie Chart' }),
                getCatalogPluginMock({ id: 'cloud-watch', name: 'CloudWatch' }),
            ], Sorters.nameDesc);
            expect(sorted.map(function (_a) {
                var name = _a.name;
                return name;
            })).toEqual(['Zabbix', 'Snowflake', 'Pie Chart', 'Jira', 'CloudWatch']);
        });
        test('should be possible to sort by `updated` (latest first)', function () {
            var sorted = sortPlugins([
                getCatalogPluginMock({ id: 'zabbix', updatedAt: '2010-01-01' }),
                getCatalogPluginMock({ id: 'snowflake', updatedAt: '2012-01-01' }),
                getCatalogPluginMock({ id: 'jira', updatedAt: '2005-01-01' }),
                getCatalogPluginMock({ id: 'pie-chart', updatedAt: '2021-01-01' }),
                getCatalogPluginMock({ id: 'cloud-watch', updatedAt: '2009-01-01' }),
            ], Sorters.updated);
            expect(sorted.map(function (_a) {
                var id = _a.id;
                return id;
            })).toEqual(['pie-chart', 'snowflake', 'zabbix', 'cloud-watch', 'jira']);
        });
        test('should be possible to sort by `published` (latest first)', function () {
            var sorted = sortPlugins([
                getCatalogPluginMock({ id: 'zabbix', publishedAt: '2010-01-01' }),
                getCatalogPluginMock({ id: 'snowflake', publishedAt: '2012-01-01' }),
                getCatalogPluginMock({ id: 'jira', publishedAt: '2005-01-01' }),
                getCatalogPluginMock({ id: 'pie-chart', publishedAt: '2021-01-01' }),
                getCatalogPluginMock({ id: 'cloud-watch', publishedAt: '2009-01-01' }),
            ], Sorters.published);
            expect(sorted.map(function (_a) {
                var id = _a.id;
                return id;
            })).toEqual(['pie-chart', 'snowflake', 'zabbix', 'cloud-watch', 'jira']);
        });
        test('should be possible to sort by `downloads` (greatest first)', function () {
            var sorted = sortPlugins([
                getCatalogPluginMock({ id: 'zabbix', downloads: 30 }),
                getCatalogPluginMock({ id: 'snowflake', downloads: 10 }),
                getCatalogPluginMock({ id: 'jira', downloads: 100 }),
                getCatalogPluginMock({ id: 'pie-chart', downloads: 350 }),
                getCatalogPluginMock({ id: 'cloud-watch', downloads: 200 }),
            ], Sorters.downloads);
            expect(sorted.map(function (_a) {
                var id = _a.id;
                return id;
            })).toEqual(['pie-chart', 'cloud-watch', 'jira', 'zabbix', 'snowflake']);
        });
    });
});
//# sourceMappingURL=helpers.test.js.map