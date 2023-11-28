import { PluginSignatureStatus, PluginSignatureType, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getLocalPluginMock, getRemotePluginMock, getCatalogPluginMock } from './__mocks__';
import { mapToCatalogPlugin, mapRemoteToCatalog, mapLocalToCatalog, mergeLocalAndRemote, mergeLocalsAndRemotes, sortPlugins, Sorters, isLocalPluginVisibleByConfig, isRemotePluginVisibleByConfig, } from './helpers';
import { RemotePluginStatus } from './types';
describe('Plugins/Helpers', () => {
    let remotePlugin;
    let localPlugin;
    beforeEach(() => {
        remotePlugin = getRemotePluginMock();
        localPlugin = getLocalPluginMock();
    });
    describe('mergeLocalsAndRemotes()', () => {
        const localPlugins = [
            getLocalPluginMock({ id: 'plugin-1' }),
            getLocalPluginMock({ id: 'plugin-2' }),
            getLocalPluginMock({ id: 'plugin-3' }), // only on local
        ];
        const remotePlugins = [
            getRemotePluginMock({ slug: 'plugin-1' }),
            getRemotePluginMock({ slug: 'plugin-2' }),
            getRemotePluginMock({ slug: 'plugin-4' }), // only on remote
        ];
        test('adds all available plugins only once', () => {
            const merged = mergeLocalsAndRemotes(localPlugins, remotePlugins);
            const mergedIds = merged.map(({ id }) => id);
            expect(merged.length).toBe(4);
            expect(mergedIds).toContain('plugin-1');
            expect(mergedIds).toContain('plugin-2');
            expect(mergedIds).toContain('plugin-3');
            expect(mergedIds).toContain('plugin-4');
        });
        test('merges all plugins with their counterpart (if available)', () => {
            const merged = mergeLocalsAndRemotes(localPlugins, remotePlugins);
            const findMerged = (mergedId) => merged.find(({ id }) => id === mergedId);
            // Both local & remote counterparts
            expect(findMerged('plugin-1')).toEqual(mergeLocalAndRemote(getLocalPluginMock({ id: 'plugin-1' }), getRemotePluginMock({ slug: 'plugin-1' })));
            expect(findMerged('plugin-2')).toEqual(mergeLocalAndRemote(getLocalPluginMock({ id: 'plugin-2' }), getRemotePluginMock({ slug: 'plugin-2' })));
            // Only local
            expect(findMerged('plugin-3')).toEqual(mergeLocalAndRemote(getLocalPluginMock({ id: 'plugin-3' })));
            // Only remote
            expect(findMerged('plugin-4')).toEqual(mergeLocalAndRemote(undefined, getRemotePluginMock({ slug: 'plugin-4' })));
        });
        test('skips deprecated plugins unless they have a local - installed - counterpart', () => {
            const merged = mergeLocalsAndRemotes(localPlugins, [
                ...remotePlugins,
                getRemotePluginMock({ slug: 'plugin-5', status: RemotePluginStatus.Deprecated }),
            ]);
            const findMerged = (mergedId) => merged.find(({ id }) => id === mergedId);
            expect(merged).toHaveLength(4);
            expect(findMerged('plugin-5')).toBeUndefined();
        });
        test('keeps deprecated plugins in case they have a local counterpart', () => {
            var _a;
            const merged = mergeLocalsAndRemotes([...localPlugins, getLocalPluginMock({ id: 'plugin-5' })], [...remotePlugins, getRemotePluginMock({ slug: 'plugin-5', status: RemotePluginStatus.Deprecated })]);
            const findMerged = (mergedId) => merged.find(({ id }) => id === mergedId);
            expect(merged).toHaveLength(5);
            expect(findMerged('plugin-5')).not.toBeUndefined();
            expect((_a = findMerged('plugin-5')) === null || _a === void 0 ? void 0 : _a.isDeprecated).toBe(true);
        });
    });
    describe('mergeLocalAndRemote()', () => {
        test('merges using mapRemoteToCatalog() if there is only a remote version', () => {
            expect(mergeLocalAndRemote(undefined, remotePlugin)).toEqual(mapRemoteToCatalog(remotePlugin));
        });
        test('merges using mapLocalToCatalog() if there is only a local version', () => {
            expect(mergeLocalAndRemote(localPlugin)).toEqual(mapLocalToCatalog(localPlugin));
        });
        test('merges using mapToCatalogPlugin() if there is both a remote and a local version', () => {
            expect(mergeLocalAndRemote(localPlugin, remotePlugin)).toEqual(mapToCatalogPlugin(localPlugin, remotePlugin));
        });
    });
    describe('mapRemoteToCatalog()', () => {
        test('maps the remote response (GCOM /api/plugins/<id>) to PluginCatalog', () => {
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
                isDeprecated: false,
                isPublished: true,
                name: 'Zabbix',
                orgName: 'Alexander Zobnin',
                popularity: 0.2111,
                publishedAt: '2016-04-06T20:23:41.000Z',
                signature: 'valid',
                type: 'app',
                updatedAt: '2021-05-18T14:53:01.000Z',
            });
        });
        test('adds the correct signature enum', () => {
            const pluginWithoutSignature = Object.assign(Object.assign({}, remotePlugin), { signatureType: '', versionSignatureType: '' });
            // With only "signatureType" -> invalid
            const pluginWithSignature1 = Object.assign(Object.assign({}, remotePlugin), { signatureType: PluginSignatureType.commercial, versionSignatureType: '' });
            // With only "versionSignatureType" -> invalid
            const pluginWithSignature2 = Object.assign(Object.assign({}, remotePlugin), { signatureType: '', versionSignatureType: PluginSignatureType.core });
            // With signatureType and versionSignatureType -> valid
            const pluginWithSignature3 = Object.assign(Object.assign({}, remotePlugin), { signatureType: PluginSignatureType.commercial, versionSignatureType: PluginSignatureType.commercial });
            expect(mapRemoteToCatalog(pluginWithoutSignature).signature).toBe(PluginSignatureStatus.missing);
            expect(mapRemoteToCatalog(pluginWithSignature1).signature).toBe(PluginSignatureStatus.missing);
            expect(mapRemoteToCatalog(pluginWithSignature2).signature).toBe(PluginSignatureStatus.missing);
            expect(mapRemoteToCatalog(pluginWithSignature3).signature).toBe(PluginSignatureStatus.valid);
        });
        test('adds an "isEnterprise" field', () => {
            const enterprisePlugin = Object.assign(Object.assign({}, remotePlugin), { status: RemotePluginStatus.Enterprise });
            const notEnterprisePlugin = Object.assign(Object.assign({}, remotePlugin), { status: RemotePluginStatus.Active });
            expect(mapRemoteToCatalog(enterprisePlugin).isEnterprise).toBe(true);
            expect(mapRemoteToCatalog(notEnterprisePlugin).isEnterprise).toBe(false);
        });
        test('adds an "isCore" field', () => {
            const corePlugin = Object.assign(Object.assign({}, remotePlugin), { internal: true });
            const notCorePlugin = Object.assign(Object.assign({}, remotePlugin), { internal: false });
            expect(mapRemoteToCatalog(corePlugin).isCore).toBe(true);
            expect(mapRemoteToCatalog(notCorePlugin).isCore).toBe(false);
        });
    });
    describe('mapLocalToCatalog()', () => {
        test('maps local response to PluginCatalog', () => {
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
                isPublished: false,
                isDeprecated: false,
                name: 'Zabbix',
                orgName: 'Alexander Zobnin',
                popularity: 0,
                publishedAt: '',
                signature: 'valid',
                signatureOrg: 'Alexander Zobnin',
                signatureType: 'community',
                type: 'app',
                updatedAt: '2021-08-25',
                installedVersion: '4.2.2',
            });
        });
        test('isCore if signature is internal', () => {
            const pluginWithoutInternalSignature = Object.assign({}, localPlugin);
            const pluginWithInternalSignature = Object.assign(Object.assign({}, localPlugin), { signature: 'internal' });
            expect(mapLocalToCatalog(pluginWithoutInternalSignature).isCore).toBe(false);
            expect(mapLocalToCatalog(pluginWithInternalSignature).isCore).toBe(true);
        });
        test('isDev if local.dev', () => {
            const pluginWithoutDev = Object.assign(Object.assign({}, localPlugin), { dev: false });
            const pluginWithDev = Object.assign(Object.assign({}, localPlugin), { dev: true });
            expect(mapLocalToCatalog(pluginWithoutDev).isDev).toBe(false);
            expect(mapLocalToCatalog(pluginWithDev).isDev).toBe(true);
        });
    });
    describe('mapToCatalogPlugin()', () => {
        test('merges local and remote plugin data correctly', () => {
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
                isPublished: true,
                isDeprecated: false,
                name: 'Zabbix',
                orgName: 'Alexander Zobnin',
                popularity: 0.2111,
                publishedAt: '2016-04-06T20:23:41.000Z',
                signature: 'valid',
                signatureOrg: 'Alexander Zobnin',
                signatureType: 'community',
                type: 'app',
                updatedAt: '2021-05-18T14:53:01.000Z',
                installedVersion: '4.2.2',
            });
        });
        test('`.description` - prefers the local', () => {
            // Local & Remote
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { info: Object.assign(Object.assign({}, localPlugin.info), { description: 'Local description' }) }), Object.assign(Object.assign({}, remotePlugin), { description: 'Remote description' }))).toMatchObject({ description: 'Local description' });
            // Remote only
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { description: 'Remote description' }))).toMatchObject({
                description: 'Remote description',
            });
            // Local only
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { info: Object.assign(Object.assign({}, localPlugin.info), { description: 'Local description' }) }))).toMatchObject({ description: 'Local description' });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ description: '' });
        });
        test('`.hasUpdate` - prefers the local', () => {
            // Local only
            expect(mapToCatalogPlugin(Object.assign({}, localPlugin))).toMatchObject({ hasUpdate: false });
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { hasUpdate: true }))).toMatchObject({ hasUpdate: true });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ hasUpdate: false });
        });
        test('`.downloads` - relies on the remote', () => {
            // Local & Remote
            expect(mapToCatalogPlugin(localPlugin, Object.assign(Object.assign({}, remotePlugin), { downloads: 99 }))).toMatchObject({ downloads: 99 });
            // Remote only
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { downloads: 99 }))).toMatchObject({ downloads: 99 });
            // Local only
            expect(mapToCatalogPlugin(localPlugin)).toMatchObject({ downloads: 0 });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ downloads: 0 });
        });
        test('`.isCore` - prefers the remote', () => {
            // Local & Remote
            expect(mapToCatalogPlugin(localPlugin, Object.assign(Object.assign({}, remotePlugin), { internal: true }))).toMatchObject({ isCore: true });
            // Remote only
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { internal: true }))).toMatchObject({ isCore: true });
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { internal: false }))).toMatchObject({ isCore: false });
            // Local only
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { signature: PluginSignatureStatus.internal }))).toMatchObject({
                isCore: true,
            });
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { signature: PluginSignatureStatus.valid }))).toMatchObject({
                isCore: false,
            });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ isCore: false });
        });
        test('`.isDev` - prefers the local', () => {
            // Local & Remote
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { dev: true }), remotePlugin)).toMatchObject({ isDev: true });
            // Remote only
            expect(mapToCatalogPlugin(undefined, remotePlugin)).toMatchObject({ isDev: false });
            // Local only
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { dev: true }), undefined)).toMatchObject({ isDev: true });
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { dev: undefined }), undefined)).toMatchObject({ isDev: false });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ isDev: false });
        });
        test('`.isEnterprise` - prefers the remote', () => {
            // Local & Remote
            expect(mapToCatalogPlugin(localPlugin, Object.assign(Object.assign({}, remotePlugin), { status: RemotePluginStatus.Enterprise }))).toMatchObject({
                isEnterprise: true,
            });
            expect(mapToCatalogPlugin(localPlugin, Object.assign(Object.assign({}, remotePlugin), { status: RemotePluginStatus.Active }))).toMatchObject({
                isEnterprise: false,
            });
            // Remote only
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { status: RemotePluginStatus.Enterprise }))).toMatchObject({
                isEnterprise: true,
            });
            // Local only
            expect(mapToCatalogPlugin(localPlugin)).toMatchObject({ isEnterprise: false });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ isEnterprise: false });
        });
        test('`.isDeprecated` - comes from the remote', () => {
            // Local & Remote
            expect(mapToCatalogPlugin(localPlugin, Object.assign(Object.assign({}, remotePlugin), { status: RemotePluginStatus.Deprecated }))).toMatchObject({
                isDeprecated: true,
            });
            expect(mapToCatalogPlugin(localPlugin, Object.assign(Object.assign({}, remotePlugin), { status: RemotePluginStatus.Enterprise }))).toMatchObject({
                isDeprecated: false,
            });
            // Remote only
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { status: RemotePluginStatus.Deprecated }))).toMatchObject({
                isDeprecated: true,
            });
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { status: RemotePluginStatus.Enterprise }))).toMatchObject({
                isDeprecated: false,
            });
            // Local only
            expect(mapToCatalogPlugin(localPlugin)).toMatchObject({ isDeprecated: false });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ isDeprecated: false });
        });
        test('`.isInstalled` - prefers the local', () => {
            // Local & Remote
            expect(mapToCatalogPlugin(localPlugin, remotePlugin)).toMatchObject({ isInstalled: true });
            // Remote only
            expect(mapToCatalogPlugin(undefined, remotePlugin)).toMatchObject({ isInstalled: false });
            // Local only
            expect(mapToCatalogPlugin(localPlugin, undefined)).toMatchObject({ isInstalled: true });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ isInstalled: false });
        });
        test('`.name` - prefers the remote', () => {
            // Local & Remote
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { name: 'Local name' }), Object.assign(Object.assign({}, remotePlugin), { name: 'Remote name' }))).toMatchObject({ name: 'Remote name' });
            // Remote only
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { name: 'Remote name' }))).toMatchObject({
                name: 'Remote name',
            });
            // Local only
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { name: 'Local name' }))).toMatchObject({ name: 'Local name' });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ name: '' });
        });
        test('`.orgName` - prefers the remote', () => {
            // Local & Remote
            expect(mapToCatalogPlugin(localPlugin, Object.assign(Object.assign({}, remotePlugin), { orgName: 'Remote org' }))).toMatchObject({
                orgName: 'Remote org',
            });
            // Remote only
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { orgName: 'Remote org' }))).toMatchObject({
                orgName: 'Remote org',
            });
            // Local only
            expect(mapToCatalogPlugin(localPlugin)).toMatchObject({ orgName: 'Alexander Zobnin' });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ orgName: '' });
        });
        test('`.popularity` - prefers the remote', () => {
            // Local & Remote
            expect(mapToCatalogPlugin(localPlugin, Object.assign(Object.assign({}, remotePlugin), { popularity: 10 }))).toMatchObject({ popularity: 10 });
            // Remote only
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { popularity: 10 }))).toMatchObject({ popularity: 10 });
            // Local only
            expect(mapToCatalogPlugin(localPlugin)).toMatchObject({ popularity: 0 });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ popularity: 0 });
        });
        test('`.publishedAt` - prefers the remote', () => {
            // Local & Remote
            expect(mapToCatalogPlugin(localPlugin, Object.assign(Object.assign({}, remotePlugin), { createdAt: '2020-01-01' }))).toMatchObject({
                publishedAt: '2020-01-01',
            });
            // Remote only
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { createdAt: '2020-01-01' }))).toMatchObject({
                publishedAt: '2020-01-01',
            });
            // Local only
            expect(mapToCatalogPlugin(localPlugin)).toMatchObject({ publishedAt: '' });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ publishedAt: '' });
        });
        test('`.type` - prefers the local', () => {
            // Local & Remote
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { type: PluginType.app }), Object.assign(Object.assign({}, remotePlugin), { typeCode: PluginType.datasource }))).toMatchObject({
                type: PluginType.app,
            });
            // Remote only
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { typeCode: PluginType.datasource }))).toMatchObject({
                type: PluginType.datasource,
            });
            // Local only
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { type: PluginType.app }))).toMatchObject({
                type: PluginType.app,
            });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ type: undefined });
        });
        test('`.signature` - prefers the local', () => {
            // Local & Remote
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { signature: PluginSignatureStatus.valid }), Object.assign(Object.assign({}, remotePlugin), { signatureType: '', versionSignatureType: '' }))).toMatchObject({
                signature: PluginSignatureStatus.valid,
            });
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { signature: PluginSignatureStatus.missing }), Object.assign(Object.assign({}, remotePlugin), { signatureType: PluginSignatureType.grafana, versionSignatureType: PluginSignatureType.grafana }))).toMatchObject({
                signature: PluginSignatureStatus.missing,
            });
            // Remote only
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { signatureType: PluginSignatureType.grafana }))).toMatchObject({
                signature: PluginSignatureStatus.valid,
            });
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { versionSignatureType: PluginSignatureType.grafana }))).toMatchObject({
                signature: PluginSignatureStatus.valid,
            });
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { signatureType: '', versionSignatureType: '' }))).toMatchObject({
                signature: PluginSignatureStatus.missing,
            });
            // Local only
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { signature: PluginSignatureStatus.valid }))).toMatchObject({
                signature: PluginSignatureStatus.valid,
            });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ signature: PluginSignatureStatus.missing });
        });
        test('`.signatureOrg` - prefers the local', () => {
            // Local & Remote
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { signatureOrg: 'Local Org' }), Object.assign(Object.assign({}, remotePlugin), { versionSignedByOrgName: 'Remote Org' }))).toMatchObject({
                signatureOrg: 'Local Org',
            });
            // Remote only
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { versionSignedByOrgName: 'Remote Org' }))).toMatchObject({
                signatureOrg: 'Remote Org',
            });
            // Local only
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { signatureOrg: 'Local Org' }))).toMatchObject({
                signatureOrg: 'Local Org',
            });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ signatureOrg: undefined });
        });
        test('`.signatureType` - prefers the local', () => {
            // Local & Remote
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { signatureType: PluginSignatureType.core }), Object.assign(Object.assign({}, remotePlugin), { signatureType: PluginSignatureType.grafana }))).toMatchObject({
                signatureType: PluginSignatureType.core,
            });
            // Remote only
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { versionSignatureType: PluginSignatureType.core, signatureType: PluginSignatureType.grafana }))).toMatchObject({
                signatureType: PluginSignatureType.core,
            });
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { versionSignatureType: '', signatureType: PluginSignatureType.grafana }))).toMatchObject({
                signatureType: PluginSignatureType.grafana,
            });
            // Local only
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { signatureType: PluginSignatureType.core }))).toMatchObject({
                signatureType: PluginSignatureType.core,
            });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ signatureType: undefined });
        });
        test('`.updatedAt` - prefers the remote', () => {
            // Local & Remote
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { info: Object.assign(Object.assign({}, localPlugin.info), { updated: '2019-01-01' }) }), Object.assign(Object.assign({}, remotePlugin), { updatedAt: '2020-01-01' }))).toMatchObject({
                updatedAt: '2020-01-01',
            });
            // Remote only
            expect(mapToCatalogPlugin(undefined, Object.assign(Object.assign({}, remotePlugin), { updatedAt: '2020-01-01' }))).toMatchObject({
                updatedAt: '2020-01-01',
            });
            // Local only
            expect(mapToCatalogPlugin(Object.assign(Object.assign({}, localPlugin), { info: Object.assign(Object.assign({}, localPlugin.info), { updated: '2019-01-01' }) }))).toMatchObject({
                updatedAt: '2019-01-01',
            });
            // No local or remote
            expect(mapToCatalogPlugin()).toMatchObject({ updatedAt: '' });
        });
    });
    describe('sortPlugins()', () => {
        test('should be possible to sort by `name` ASC', () => {
            const sorted = sortPlugins([
                getCatalogPluginMock({ id: 'zabbix', name: 'Zabbix' }),
                getCatalogPluginMock({ id: 'snowflake', name: 'Snowflake' }),
                getCatalogPluginMock({ id: 'jira', name: 'Jira' }),
                getCatalogPluginMock({ id: 'pie-chart', name: 'Pie Chart' }),
                getCatalogPluginMock({ id: 'cloud-watch', name: 'CloudWatch' }),
            ], Sorters.nameAsc);
            expect(sorted.map(({ name }) => name)).toEqual(['CloudWatch', 'Jira', 'Pie Chart', 'Snowflake', 'Zabbix']);
        });
        test('should be possible to sort by `name` DESC', () => {
            const sorted = sortPlugins([
                getCatalogPluginMock({ id: 'zabbix', name: 'Zabbix' }),
                getCatalogPluginMock({ id: 'snowflake', name: 'Snowflake' }),
                getCatalogPluginMock({ id: 'jira', name: 'Jira' }),
                getCatalogPluginMock({ id: 'pie-chart', name: 'Pie Chart' }),
                getCatalogPluginMock({ id: 'cloud-watch', name: 'CloudWatch' }),
            ], Sorters.nameDesc);
            expect(sorted.map(({ name }) => name)).toEqual(['Zabbix', 'Snowflake', 'Pie Chart', 'Jira', 'CloudWatch']);
        });
        test('should be possible to sort by `updated` (latest first)', () => {
            const sorted = sortPlugins([
                getCatalogPluginMock({ id: 'zabbix', updatedAt: '2010-01-01' }),
                getCatalogPluginMock({ id: 'snowflake', updatedAt: '2012-01-01' }),
                getCatalogPluginMock({ id: 'jira', updatedAt: '2005-01-01' }),
                getCatalogPluginMock({ id: 'pie-chart', updatedAt: '2021-01-01' }),
                getCatalogPluginMock({ id: 'cloud-watch', updatedAt: '2009-01-01' }),
            ], Sorters.updated);
            expect(sorted.map(({ id }) => id)).toEqual(['pie-chart', 'snowflake', 'zabbix', 'cloud-watch', 'jira']);
        });
        test('should be possible to sort by `published` (latest first)', () => {
            const sorted = sortPlugins([
                getCatalogPluginMock({ id: 'zabbix', publishedAt: '2010-01-01' }),
                getCatalogPluginMock({ id: 'snowflake', publishedAt: '2012-01-01' }),
                getCatalogPluginMock({ id: 'jira', publishedAt: '2005-01-01' }),
                getCatalogPluginMock({ id: 'pie-chart', publishedAt: '2021-01-01' }),
                getCatalogPluginMock({ id: 'cloud-watch', publishedAt: '2009-01-01' }),
            ], Sorters.published);
            expect(sorted.map(({ id }) => id)).toEqual(['pie-chart', 'snowflake', 'zabbix', 'cloud-watch', 'jira']);
        });
        test('should be possible to sort by `downloads` (greatest first)', () => {
            const sorted = sortPlugins([
                getCatalogPluginMock({ id: 'zabbix', downloads: 30 }),
                getCatalogPluginMock({ id: 'snowflake', downloads: 10 }),
                getCatalogPluginMock({ id: 'jira', downloads: 100 }),
                getCatalogPluginMock({ id: 'pie-chart', downloads: 350 }),
                getCatalogPluginMock({ id: 'cloud-watch', downloads: 200 }),
            ], Sorters.downloads);
            expect(sorted.map(({ id }) => id)).toEqual(['pie-chart', 'cloud-watch', 'jira', 'zabbix', 'snowflake']);
        });
    });
    describe('isLocalPluginVisible()', () => {
        test('should return TRUE if the plugin is not listed as hidden in the main Grafana configuration', () => {
            config.pluginCatalogHiddenPlugins = ['akumuli-datasource'];
            const plugin = getLocalPluginMock({
                id: 'barchart',
            });
            expect(isLocalPluginVisibleByConfig(plugin)).toBe(true);
        });
        test('should return FALSE if the plugin is listed as hidden in the main Grafana configuration', () => {
            config.pluginCatalogHiddenPlugins = ['akumuli-datasource'];
            const plugin = getLocalPluginMock({
                id: 'akumuli-datasource',
            });
            expect(isLocalPluginVisibleByConfig(plugin)).toBe(false);
        });
    });
    describe('isRemotePluginVisible()', () => {
        test('should return TRUE if the plugin is not listed as hidden in the main Grafana configuration', () => {
            config.pluginCatalogHiddenPlugins = ['akumuli-datasource'];
            const plugin = getRemotePluginMock({
                slug: 'barchart',
            });
            expect(isRemotePluginVisibleByConfig(plugin)).toBe(true);
        });
        test('should return FALSE if the plugin is listed as hidden in the main Grafana configuration', () => {
            config.pluginCatalogHiddenPlugins = ['akumuli-datasource'];
            const plugin = getRemotePluginMock({
                slug: 'akumuli-datasource',
            });
            expect(isRemotePluginVisibleByConfig(plugin)).toBe(false);
        });
    });
});
//# sourceMappingURL=helpers.test.js.map