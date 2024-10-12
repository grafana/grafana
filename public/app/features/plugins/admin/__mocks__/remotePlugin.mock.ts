import { PluginSignatureType, PluginType } from '@grafana/data';

import { RemotePlugin } from '../types';

// Copied from /api/gnet/plugins/alexanderzobnin-zabbix-app
export default {
  changelog: '',
  createdAt: '2016-04-06T20:23:41.000Z',
  description: 'Zabbix plugin for Grafana',
  downloads: 33645089,
  featured: 180,
  id: 74,
  keywords: ['zabbix', 'monitoring', 'dashboard'],
  typeId: 1,
  typeName: 'Application',
  internal: false,
  links: [],
  name: 'Zabbix',
  orgId: 13056,
  orgName: 'Alexander Zobnin',
  orgSlug: 'alexanderzobnin',
  orgUrl: 'https://github.com/alexanderzobnin',
  url: 'https://github.com/alexanderzobnin/grafana-zabbix',
  verified: false,
  downloadSlug: 'alexanderzobnin-zabbix-app',
  packages: {},
  popularity: 0.2111,
  signatureType: PluginSignatureType.community,
  slug: 'alexanderzobnin-zabbix-app',
  status: 'active',
  typeCode: PluginType.app,
  updatedAt: '2021-05-18T14:53:01.000Z',
  version: '4.1.5',
  versionStatus: 'active',
  versionSignatureType: PluginSignatureType.community,
  versionSignedByOrg: 'alexanderzobnin',
  versionSignedByOrgName: 'Alexander Zobnin',
  userId: 0,
  readme:
    '<h1>Zabbix plugin for Grafana</h1>\n<p>:copyright: 2015-2021 Alexander Zobnin alexanderzobnin@gmail.com</p>\n<p>Licensed under the Apache 2.0 License</p>',
  json: {
    dependencies: {
      grafanaDependency: '>=7.3.0',
      grafanaVersion: '7.3',
      plugins: [],
      extensions: {
        exposedComponents: [],
      },
    },
    info: {
      links: [],
    },
  },
  angularDetected: false,
} as RemotePlugin;
