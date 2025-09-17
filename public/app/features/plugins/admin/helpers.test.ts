import { PluginErrorCode, PluginSignatureStatus, PluginSignatureType, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';

import {
  mapToCatalogPlugin,
  mapRemoteToCatalog,
  mapLocalToCatalog,
  mergeLocalAndRemote,
  mergeLocalsAndRemotes,
  sortPlugins,
  Sorters,
  isLocalPluginVisibleByConfig,
  isRemotePluginVisibleByConfig,
  isNonAngularVersion,
  isDisabledAngularPlugin,
} from './helpers';
import { getLocalPluginMock, getRemotePluginMock, getCatalogPluginMock } from './mocks/mockHelpers';
import { RemotePlugin, LocalPlugin, RemotePluginStatus, Version, CatalogPlugin } from './types';

describe('Plugins/Helpers', () => {
  let remotePlugin: RemotePlugin;
  let localPlugin: LocalPlugin;

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
      const merged = mergeLocalsAndRemotes({ local: localPlugins, remote: remotePlugins });
      const mergedIds = merged.map(({ id }) => id);

      expect(merged.length).toBe(4);
      expect(mergedIds).toContain('plugin-1');
      expect(mergedIds).toContain('plugin-2');
      expect(mergedIds).toContain('plugin-3');
      expect(mergedIds).toContain('plugin-4');
    });

    test('merges all plugins with their counterpart (if available)', () => {
      const merged = mergeLocalsAndRemotes({ local: localPlugins, remote: remotePlugins });
      const findMerged = (mergedId: string) => merged.find(({ id }) => id === mergedId);

      // Both local & remote counterparts
      expect(findMerged('plugin-1')).toEqual(
        mergeLocalAndRemote(getLocalPluginMock({ id: 'plugin-1' }), getRemotePluginMock({ slug: 'plugin-1' }))
      );
      expect(findMerged('plugin-2')).toEqual(
        mergeLocalAndRemote(getLocalPluginMock({ id: 'plugin-2' }), getRemotePluginMock({ slug: 'plugin-2' }))
      );

      // Only local
      expect(findMerged('plugin-3')).toEqual(mergeLocalAndRemote(getLocalPluginMock({ id: 'plugin-3' })));

      // Only remote
      expect(findMerged('plugin-4')).toEqual(mergeLocalAndRemote(undefined, getRemotePluginMock({ slug: 'plugin-4' })));
    });

    test('skips deprecated plugins unless they have a local - installed - counterpart', () => {
      const merged = mergeLocalsAndRemotes({
        local: localPlugins,
        remote: [...remotePlugins, getRemotePluginMock({ slug: 'plugin-5', status: RemotePluginStatus.Deprecated })],
      });
      const findMerged = (mergedId: string) => merged.find(({ id }) => id === mergedId);

      expect(merged).toHaveLength(4);
      expect(findMerged('plugin-5')).toBeUndefined();
    });

    test('keeps deprecated plugins in case they have a local counterpart', () => {
      const merged = mergeLocalsAndRemotes({
        local: [...localPlugins, getLocalPluginMock({ id: 'plugin-5' })],
        remote: [...remotePlugins, getRemotePluginMock({ slug: 'plugin-5', status: RemotePluginStatus.Deprecated })],
      });
      const findMerged = (mergedId: string) => merged.find(({ id }) => id === mergedId);

      expect(merged).toHaveLength(5);
      expect(findMerged('plugin-5')).not.toBeUndefined();
      expect(findMerged('plugin-5')?.isDeprecated).toBe(true);
    });

    test('core plugins should be fullyInstalled in cloud', () => {
      const corePluginId = 'plugin-core';

      const oldPluginAdminExternalManageEnabled = config.pluginAdminExternalManageEnabled;

      config.pluginAdminExternalManageEnabled = true;

      const merged = mergeLocalsAndRemotes({
        local: [...localPlugins, getLocalPluginMock({ id: corePluginId, signature: PluginSignatureStatus.internal })],
        remote: [...remotePlugins, getRemotePluginMock({ slug: corePluginId })],
      });
      const findMerged = (mergedId: string) => merged.find(({ id }) => id === mergedId);

      expect(merged).toHaveLength(5);
      expect(findMerged(corePluginId)).not.toBeUndefined();
      expect(findMerged(corePluginId)?.isCore).toBe(true);
      expect(findMerged(corePluginId)?.isFullyInstalled).toBe(true);

      config.pluginAdminExternalManageEnabled = oldPluginAdminExternalManageEnabled;
    });

    test('plugins should be fully installed if they are installed and it is provisioned', () => {
      const pluginId = 'plugin-1';

      const oldPluginAdminExternalManageEnabled = config.pluginAdminExternalManageEnabled;

      config.pluginAdminExternalManageEnabled = true;

      const merged = mergeLocalsAndRemotes({
        local: [...localPlugins, getLocalPluginMock({ id: pluginId })],
        remote: [...remotePlugins, getRemotePluginMock({ slug: pluginId })],
        provisioned: [{ slug: pluginId }],
      });
      const findMerged = (mergedId: string) => merged.find(({ id }) => id === mergedId);

      expect(merged).toHaveLength(5);
      expect(findMerged(pluginId)).not.toBeUndefined();
      expect(findMerged(pluginId)?.isFullyInstalled).toBe(true);

      config.pluginAdminExternalManageEnabled = oldPluginAdminExternalManageEnabled;
    });

    test('plugins should have update when instance version is different from remote version', () => {
      const oldPluginAdminExternalManageEnabled = config.pluginAdminExternalManageEnabled;

      config.pluginAdminExternalManageEnabled = true;

      const pluginId = 'plugin-1';
      const remotePlugin = getRemotePluginMock({ slug: pluginId, version: '1.0.0' });
      const instancePlugin = {
        pluginSlug: pluginId,
        version: '0.0.9',
      };

      const merged = mergeLocalsAndRemotes({
        local: [],
        remote: [remotePlugin],
        instance: [instancePlugin],
      });
      const findMerged = (mergedId: string) => merged.find(({ id }) => id === mergedId);

      expect(merged).toHaveLength(1);
      expect(findMerged(pluginId)).not.toBeUndefined();
      expect(findMerged(pluginId)?.hasUpdate).toBe(true);

      config.pluginAdminExternalManageEnabled = oldPluginAdminExternalManageEnabled;
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
            large: '/api/gnet/plugins/alexanderzobnin-zabbix-app/versions/4.1.5/logos/large',
            small: '/api/gnet/plugins/alexanderzobnin-zabbix-app/versions/4.1.5/logos/small',
          },
          keywords: ['zabbix', 'monitoring', 'dashboard'],
        },
        error: undefined,
        isCore: false,
        isDev: false,
        isDisabled: false,
        isEnterprise: false,
        isInstalled: false,
        isDeprecated: false,
        isPublished: true,
        latestVersion: '4.1.5',
        isManaged: false,
        isPreinstalled: { found: false, withVersion: false },
        name: 'Zabbix',
        orgName: 'Alexander Zobnin',
        popularity: 0.2111,
        publishedAt: '2016-04-06T20:23:41.000Z',
        signature: 'valid',
        signatureOrg: 'Alexander Zobnin',
        signatureType: 'community',
        type: 'app',
        updatedAt: '2021-05-18T14:53:01.000Z',
        isFullyInstalled: false,
        angularDetected: false,
        url: 'https://github.com/alexanderzobnin/grafana-zabbix',
      });
    });

    test('adds the correct signature enum', () => {
      const pluginWithoutSignature = { ...remotePlugin, signatureType: '', versionSignatureType: '' } as RemotePlugin;
      // With only "signatureType" -> invalid
      const pluginWithSignature1 = {
        ...remotePlugin,
        signatureType: PluginSignatureType.commercial,
        versionSignatureType: '',
      } as RemotePlugin;
      // With only "versionSignatureType" -> invalid
      const pluginWithSignature2 = {
        ...remotePlugin,
        signatureType: '',
        versionSignatureType: PluginSignatureType.core,
      } as RemotePlugin;
      // With signatureType and versionSignatureType -> valid
      const pluginWithSignature3 = {
        ...remotePlugin,
        signatureType: PluginSignatureType.commercial,
        versionSignatureType: PluginSignatureType.commercial,
      } as RemotePlugin;

      expect(mapRemoteToCatalog(pluginWithoutSignature).signature).toBe(PluginSignatureStatus.missing);
      expect(mapRemoteToCatalog(pluginWithSignature1).signature).toBe(PluginSignatureStatus.missing);
      expect(mapRemoteToCatalog(pluginWithSignature2).signature).toBe(PluginSignatureStatus.missing);
      expect(mapRemoteToCatalog(pluginWithSignature3).signature).toBe(PluginSignatureStatus.valid);
    });

    test('adds an "isEnterprise" field', () => {
      const enterprisePlugin = { ...remotePlugin, status: RemotePluginStatus.Enterprise } as RemotePlugin;
      const notEnterprisePlugin = { ...remotePlugin, status: RemotePluginStatus.Active } as RemotePlugin;

      expect(mapRemoteToCatalog(enterprisePlugin).isEnterprise).toBe(true);
      expect(mapRemoteToCatalog(notEnterprisePlugin).isEnterprise).toBe(false);
    });

    test('adds an "isCore" field', () => {
      const corePlugin = { ...remotePlugin, internal: true } as RemotePlugin;
      const notCorePlugin = { ...remotePlugin, internal: false } as RemotePlugin;

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
        isManaged: false,
        isPreinstalled: { found: false, withVersion: false },
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
        isFullyInstalled: true,
        angularDetected: false,
      });
    });

    test('isCore if signature is internal', () => {
      const pluginWithoutInternalSignature = { ...localPlugin };
      const pluginWithInternalSignature = { ...localPlugin, signature: 'internal' } as LocalPlugin;
      expect(mapLocalToCatalog(pluginWithoutInternalSignature).isCore).toBe(false);
      expect(mapLocalToCatalog(pluginWithInternalSignature).isCore).toBe(true);
    });

    test('isDev if local.dev', () => {
      const pluginWithoutDev = { ...localPlugin, dev: false };
      const pluginWithDev = { ...localPlugin, dev: true };
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
            small: '/api/gnet/plugins/alexanderzobnin-zabbix-app/versions/4.1.5/logos/small',
            large: '/api/gnet/plugins/alexanderzobnin-zabbix-app/versions/4.1.5/logos/large',
          },
          keywords: ['zabbix', 'monitoring', 'dashboard'],
        },
        error: undefined,
        isCore: false,
        isDev: false,
        isDisabled: false,
        isEnterprise: false,
        isInstalled: true,
        isPublished: true,
        latestVersion: '4.1.5',
        isDeprecated: false,
        isManaged: false,
        isPreinstalled: { found: false, withVersion: false },
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
        isFullyInstalled: true,
        angularDetected: false,
        url: 'https://github.com/alexanderzobnin/grafana-zabbix',
      });
    });

    test('`.description` - prefers the local', () => {
      // Local & Remote
      expect(
        mapToCatalogPlugin(
          { ...localPlugin, info: { ...localPlugin.info, description: 'Local description' } },
          { ...remotePlugin, description: 'Remote description' }
        )
      ).toMatchObject({ description: 'Local description' });

      // Remote only
      expect(mapToCatalogPlugin(undefined, { ...remotePlugin, description: 'Remote description' })).toMatchObject({
        description: 'Remote description',
      });

      // Local only
      expect(
        mapToCatalogPlugin({ ...localPlugin, info: { ...localPlugin.info, description: 'Local description' } })
      ).toMatchObject({ description: 'Local description' });

      // No local or remote
      expect(mapToCatalogPlugin()).toMatchObject({ description: '' });
    });

    test('`.hasUpdate` - prefers the local', () => {
      // Local only
      expect(mapToCatalogPlugin({ ...localPlugin })).toMatchObject({ hasUpdate: false });
      expect(mapToCatalogPlugin({ ...localPlugin, hasUpdate: true })).toMatchObject({ hasUpdate: true });

      // No local or remote
      expect(mapToCatalogPlugin()).toMatchObject({ hasUpdate: false });
    });

    test('`.downloads` - relies on the remote', () => {
      // Local & Remote
      expect(mapToCatalogPlugin(localPlugin, { ...remotePlugin, downloads: 99 })).toMatchObject({ downloads: 99 });

      // Remote only
      expect(mapToCatalogPlugin(undefined, { ...remotePlugin, downloads: 99 })).toMatchObject({ downloads: 99 });

      // Local only
      expect(mapToCatalogPlugin(localPlugin)).toMatchObject({ downloads: 0 });

      // No local or remote
      expect(mapToCatalogPlugin()).toMatchObject({ downloads: 0 });
    });

    test('`.isCore` - prefers the remote', () => {
      // Local & Remote
      expect(mapToCatalogPlugin(localPlugin, { ...remotePlugin, internal: true })).toMatchObject({ isCore: true });

      // Remote only
      expect(mapToCatalogPlugin(undefined, { ...remotePlugin, internal: true })).toMatchObject({ isCore: true });
      expect(mapToCatalogPlugin(undefined, { ...remotePlugin, internal: false })).toMatchObject({ isCore: false });

      // Local only
      expect(mapToCatalogPlugin({ ...localPlugin, signature: PluginSignatureStatus.internal })).toMatchObject({
        isCore: true,
      });
      expect(mapToCatalogPlugin({ ...localPlugin, signature: PluginSignatureStatus.valid })).toMatchObject({
        isCore: false,
      });

      // No local or remote
      expect(mapToCatalogPlugin()).toMatchObject({ isCore: false });
    });

    test('`.isDev` - prefers the local', () => {
      // Local & Remote
      expect(mapToCatalogPlugin({ ...localPlugin, dev: true }, remotePlugin)).toMatchObject({ isDev: true });

      // Remote only
      expect(mapToCatalogPlugin(undefined, remotePlugin)).toMatchObject({ isDev: false });

      // Local only
      expect(mapToCatalogPlugin({ ...localPlugin, dev: true }, undefined)).toMatchObject({ isDev: true });
      expect(mapToCatalogPlugin({ ...localPlugin, dev: undefined }, undefined)).toMatchObject({ isDev: false });

      // No local or remote
      expect(mapToCatalogPlugin()).toMatchObject({ isDev: false });
    });

    test('`.isEnterprise` - prefers the remote', () => {
      // Local & Remote
      expect(mapToCatalogPlugin(localPlugin, { ...remotePlugin, status: RemotePluginStatus.Enterprise })).toMatchObject(
        {
          isEnterprise: true,
        }
      );
      expect(mapToCatalogPlugin(localPlugin, { ...remotePlugin, status: RemotePluginStatus.Active })).toMatchObject({
        isEnterprise: false,
      });

      // Remote only
      expect(mapToCatalogPlugin(undefined, { ...remotePlugin, status: RemotePluginStatus.Enterprise })).toMatchObject({
        isEnterprise: true,
      });

      // Local only
      expect(mapToCatalogPlugin(localPlugin)).toMatchObject({ isEnterprise: false });

      // No local or remote
      expect(mapToCatalogPlugin()).toMatchObject({ isEnterprise: false });
    });

    test('`.isDeprecated` - comes from the remote', () => {
      // Local & Remote
      expect(mapToCatalogPlugin(localPlugin, { ...remotePlugin, status: RemotePluginStatus.Deprecated })).toMatchObject(
        {
          isDeprecated: true,
        }
      );
      expect(mapToCatalogPlugin(localPlugin, { ...remotePlugin, status: RemotePluginStatus.Enterprise })).toMatchObject(
        {
          isDeprecated: false,
        }
      );

      // Remote only
      expect(mapToCatalogPlugin(undefined, { ...remotePlugin, status: RemotePluginStatus.Deprecated })).toMatchObject({
        isDeprecated: true,
      });
      expect(mapToCatalogPlugin(undefined, { ...remotePlugin, status: RemotePluginStatus.Enterprise })).toMatchObject({
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
      expect(
        mapToCatalogPlugin({ ...localPlugin, name: 'Local name' }, { ...remotePlugin, name: 'Remote name' })
      ).toMatchObject({ name: 'Remote name' });

      // Remote only
      expect(mapToCatalogPlugin(undefined, { ...remotePlugin, name: 'Remote name' })).toMatchObject({
        name: 'Remote name',
      });

      // Local only
      expect(mapToCatalogPlugin({ ...localPlugin, name: 'Local name' })).toMatchObject({ name: 'Local name' });

      // No local or remote
      expect(mapToCatalogPlugin()).toMatchObject({ name: '' });
    });

    test('`.orgName` - prefers the remote', () => {
      // Local & Remote
      expect(mapToCatalogPlugin(localPlugin, { ...remotePlugin, orgName: 'Remote org' })).toMatchObject({
        orgName: 'Remote org',
      });

      // Remote only
      expect(mapToCatalogPlugin(undefined, { ...remotePlugin, orgName: 'Remote org' })).toMatchObject({
        orgName: 'Remote org',
      });

      // Local only
      expect(mapToCatalogPlugin(localPlugin)).toMatchObject({ orgName: 'Alexander Zobnin' });

      // No local or remote
      expect(mapToCatalogPlugin()).toMatchObject({ orgName: '' });
    });

    test('`.popularity` - prefers the remote', () => {
      // Local & Remote
      expect(mapToCatalogPlugin(localPlugin, { ...remotePlugin, popularity: 10 })).toMatchObject({ popularity: 10 });

      // Remote only
      expect(mapToCatalogPlugin(undefined, { ...remotePlugin, popularity: 10 })).toMatchObject({ popularity: 10 });

      // Local only
      expect(mapToCatalogPlugin(localPlugin)).toMatchObject({ popularity: 0 });

      // No local or remote
      expect(mapToCatalogPlugin()).toMatchObject({ popularity: 0 });
    });

    test('`.publishedAt` - prefers the remote', () => {
      // Local & Remote
      expect(mapToCatalogPlugin(localPlugin, { ...remotePlugin, createdAt: '2020-01-01' })).toMatchObject({
        publishedAt: '2020-01-01',
      });

      // Remote only
      expect(mapToCatalogPlugin(undefined, { ...remotePlugin, createdAt: '2020-01-01' })).toMatchObject({
        publishedAt: '2020-01-01',
      });

      // Local only
      expect(mapToCatalogPlugin(localPlugin)).toMatchObject({ publishedAt: '' });

      // No local or remote
      expect(mapToCatalogPlugin()).toMatchObject({ publishedAt: '' });
    });

    test('`.type` - prefers the local', () => {
      // Local & Remote
      expect(
        mapToCatalogPlugin(
          { ...localPlugin, type: PluginType.app },
          { ...remotePlugin, typeCode: PluginType.datasource }
        )
      ).toMatchObject({
        type: PluginType.app,
      });

      // Remote only
      expect(mapToCatalogPlugin(undefined, { ...remotePlugin, typeCode: PluginType.datasource })).toMatchObject({
        type: PluginType.datasource,
      });

      // Local only
      expect(mapToCatalogPlugin({ ...localPlugin, type: PluginType.app })).toMatchObject({
        type: PluginType.app,
      });

      // No local or remote
      expect(mapToCatalogPlugin()).toMatchObject({ type: undefined });
    });

    test('`.signature` - prefers the local', () => {
      // Local & Remote
      expect(
        mapToCatalogPlugin(
          { ...localPlugin, signature: PluginSignatureStatus.valid },
          { ...remotePlugin, signatureType: '', versionSignatureType: '' }
        )
      ).toMatchObject({
        signature: PluginSignatureStatus.valid,
      });
      expect(
        mapToCatalogPlugin(
          { ...localPlugin, signature: PluginSignatureStatus.missing },
          {
            ...remotePlugin,
            signatureType: PluginSignatureType.grafana,
            versionSignatureType: PluginSignatureType.grafana,
          }
        )
      ).toMatchObject({
        signature: PluginSignatureStatus.missing,
      });

      // Remote only
      expect(
        mapToCatalogPlugin(undefined, { ...remotePlugin, signatureType: PluginSignatureType.grafana })
      ).toMatchObject({
        signature: PluginSignatureStatus.valid,
      });
      expect(
        mapToCatalogPlugin(undefined, { ...remotePlugin, versionSignatureType: PluginSignatureType.grafana })
      ).toMatchObject({
        signature: PluginSignatureStatus.valid,
      });
      expect(
        mapToCatalogPlugin(undefined, { ...remotePlugin, signatureType: '', versionSignatureType: '' })
      ).toMatchObject({
        signature: PluginSignatureStatus.missing,
      });

      // Local only
      expect(mapToCatalogPlugin({ ...localPlugin, signature: PluginSignatureStatus.valid })).toMatchObject({
        signature: PluginSignatureStatus.valid,
      });

      // No local or remote
      expect(mapToCatalogPlugin()).toMatchObject({ signature: PluginSignatureStatus.missing });
    });

    test('`.signatureOrg` - prefers the local', () => {
      // Local & Remote
      expect(
        mapToCatalogPlugin(
          { ...localPlugin, signatureOrg: 'Local Org' },
          { ...remotePlugin, versionSignedByOrgName: 'Remote Org' }
        )
      ).toMatchObject({
        signatureOrg: 'Local Org',
      });

      // Remote only
      expect(mapToCatalogPlugin(undefined, { ...remotePlugin, versionSignedByOrgName: 'Remote Org' })).toMatchObject({
        signatureOrg: 'Remote Org',
      });

      // Local only
      expect(mapToCatalogPlugin({ ...localPlugin, signatureOrg: 'Local Org' })).toMatchObject({
        signatureOrg: 'Local Org',
      });

      // No local or remote
      expect(mapToCatalogPlugin()).toMatchObject({ signatureOrg: undefined });
    });

    test('`.signatureType` - prefers the local', () => {
      // Local & Remote
      expect(
        mapToCatalogPlugin(
          { ...localPlugin, signatureType: PluginSignatureType.core },
          { ...remotePlugin, signatureType: PluginSignatureType.grafana }
        )
      ).toMatchObject({
        signatureType: PluginSignatureType.core,
      });

      // Remote only
      expect(
        mapToCatalogPlugin(undefined, {
          ...remotePlugin,
          versionSignatureType: PluginSignatureType.core,
          signatureType: PluginSignatureType.grafana,
        })
      ).toMatchObject({
        signatureType: PluginSignatureType.core,
      });
      expect(
        mapToCatalogPlugin(undefined, {
          ...remotePlugin,
          versionSignatureType: '',
          signatureType: PluginSignatureType.grafana,
        })
      ).toMatchObject({
        signatureType: PluginSignatureType.grafana,
      });

      // Local only
      expect(mapToCatalogPlugin({ ...localPlugin, signatureType: PluginSignatureType.core })).toMatchObject({
        signatureType: PluginSignatureType.core,
      });

      // No local or remote
      expect(mapToCatalogPlugin()).toMatchObject({ signatureType: undefined });
    });

    test('`.updatedAt` - prefers the remote', () => {
      // Local & Remote
      expect(
        mapToCatalogPlugin(
          { ...localPlugin, info: { ...localPlugin.info, updated: '2019-01-01' } },
          { ...remotePlugin, updatedAt: '2020-01-01' }
        )
      ).toMatchObject({
        updatedAt: '2020-01-01',
      });

      // Remote only
      expect(mapToCatalogPlugin(undefined, { ...remotePlugin, updatedAt: '2020-01-01' })).toMatchObject({
        updatedAt: '2020-01-01',
      });

      // Local only
      expect(
        mapToCatalogPlugin({ ...localPlugin, info: { ...localPlugin.info, updated: '2019-01-01' } })
      ).toMatchObject({
        updatedAt: '2019-01-01',
      });

      // No local or remote
      expect(mapToCatalogPlugin()).toMatchObject({ updatedAt: '' });
    });

    test('`.angularDetected` - prefers the local', () => {
      // Both false shoul return false
      expect(
        mapToCatalogPlugin({ ...localPlugin, angularDetected: false }, { ...remotePlugin, angularDetected: false })
      ).toMatchObject({ angularDetected: false });

      // Remote version is using angular, local isn't, should prefer local
      expect(
        mapToCatalogPlugin({ ...localPlugin, angularDetected: false }, { ...remotePlugin, angularDetected: true })
      ).toMatchObject({ angularDetected: false });

      // Remote only
      expect(mapToCatalogPlugin(undefined, remotePlugin)).toMatchObject({ angularDetected: false });
      expect(mapToCatalogPlugin(undefined, { ...remotePlugin, angularDetected: true })).toMatchObject({
        angularDetected: true,
      });

      // Local only
      expect(mapToCatalogPlugin({ ...localPlugin, angularDetected: false }, undefined)).toMatchObject({
        angularDetected: false,
      });
      expect(mapToCatalogPlugin({ ...localPlugin, angularDetected: true }, undefined)).toMatchObject({
        angularDetected: true,
      });

      // No local or remote
      expect(mapToCatalogPlugin()).toMatchObject({ angularDetected: undefined });
    });
  });

  describe('sortPlugins()', () => {
    test('should be possible to sort by `name` ASC', () => {
      const sorted = sortPlugins(
        [
          getCatalogPluginMock({ id: 'zabbix', name: 'Zabbix' }),
          getCatalogPluginMock({ id: 'snowflake', name: 'Snowflake' }),
          getCatalogPluginMock({ id: 'jira', name: 'Jira' }),
          getCatalogPluginMock({ id: 'pie-chart', name: 'Pie Chart' }),
          getCatalogPluginMock({ id: 'cloud-watch', name: 'CloudWatch' }),
        ],
        Sorters.nameAsc
      );

      expect(sorted.map(({ name }) => name)).toEqual(['CloudWatch', 'Jira', 'Pie Chart', 'Snowflake', 'Zabbix']);
    });

    test('should be possible to sort by `name` DESC', () => {
      const sorted = sortPlugins(
        [
          getCatalogPluginMock({ id: 'zabbix', name: 'Zabbix' }),
          getCatalogPluginMock({ id: 'snowflake', name: 'Snowflake' }),
          getCatalogPluginMock({ id: 'jira', name: 'Jira' }),
          getCatalogPluginMock({ id: 'pie-chart', name: 'Pie Chart' }),
          getCatalogPluginMock({ id: 'cloud-watch', name: 'CloudWatch' }),
        ],
        Sorters.nameDesc
      );

      expect(sorted.map(({ name }) => name)).toEqual(['Zabbix', 'Snowflake', 'Pie Chart', 'Jira', 'CloudWatch']);
    });

    test('should be possible to sort by `updated` (latest first)', () => {
      const sorted = sortPlugins(
        [
          getCatalogPluginMock({ id: 'zabbix', updatedAt: '2010-01-01' }),
          getCatalogPluginMock({ id: 'snowflake', updatedAt: '2012-01-01' }),
          getCatalogPluginMock({ id: 'jira', updatedAt: '2005-01-01' }),
          getCatalogPluginMock({ id: 'pie-chart', updatedAt: '2021-01-01' }),
          getCatalogPluginMock({ id: 'cloud-watch', updatedAt: '2009-01-01' }),
        ],
        Sorters.updated
      );

      expect(sorted.map(({ id }) => id)).toEqual(['pie-chart', 'snowflake', 'zabbix', 'cloud-watch', 'jira']);
    });

    test('should be possible to sort by `published` (latest first)', () => {
      const sorted = sortPlugins(
        [
          getCatalogPluginMock({ id: 'zabbix', publishedAt: '2010-01-01' }),
          getCatalogPluginMock({ id: 'snowflake', publishedAt: '2012-01-01' }),
          getCatalogPluginMock({ id: 'jira', publishedAt: '2005-01-01' }),
          getCatalogPluginMock({ id: 'pie-chart', publishedAt: '2021-01-01' }),
          getCatalogPluginMock({ id: 'cloud-watch', publishedAt: '2009-01-01' }),
        ],
        Sorters.published
      );

      expect(sorted.map(({ id }) => id)).toEqual(['pie-chart', 'snowflake', 'zabbix', 'cloud-watch', 'jira']);
    });

    test('should be possible to sort by `downloads` (greatest first)', () => {
      const sorted = sortPlugins(
        [
          getCatalogPluginMock({ id: 'zabbix', downloads: 30 }),
          getCatalogPluginMock({ id: 'snowflake', downloads: 10 }),
          getCatalogPluginMock({ id: 'jira', downloads: 100 }),
          getCatalogPluginMock({ id: 'pie-chart', downloads: 350 }),
          getCatalogPluginMock({ id: 'cloud-watch', downloads: 200 }),
        ],
        Sorters.downloads
      );

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

  describe('isNonAngularVersion()', () => {
    test('should return TRUE if the version is not using angular', () => {
      expect(isNonAngularVersion({ angularDetected: false } as Version)).toBe(true);
    });

    test('should return FALSE if the version is using angular', () => {
      expect(isNonAngularVersion({ angularDetected: true } as Version)).toBe(false);
    });

    test('should return FALSE if the version is not set', () => {
      expect(isNonAngularVersion(undefined)).toBe(false);
    });
  });

  describe('isDisabledAngularPlugin', () => {
    it('should return true for disabled angular plugins', () => {
      const plugin = { isDisabled: true, error: PluginErrorCode.angular } as CatalogPlugin;
      expect(isDisabledAngularPlugin(plugin)).toBe(true);
    });

    it('should return false for non-angular plugins', () => {
      const plugin = { isDisabled: true, error: undefined } as CatalogPlugin;
      expect(isDisabledAngularPlugin(plugin)).toBe(false);
    });

    it('should return false for plugins that are not disabled', () => {
      const plugin = { isDisabled: false, error: undefined } as CatalogPlugin;
      expect(isDisabledAngularPlugin(plugin)).toBe(false);
    });
  });
});
