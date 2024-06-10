import { LocalPlugin } from '../types';

// Copied from /api/plugins
export default {
  name: 'Zabbix',
  type: 'app',
  id: 'alexanderzobnin-zabbix-app',
  enabled: false,
  pinned: false,
  info: {
    author: {
      name: 'Alexander Zobnin',
      url: 'https://github.com/alexanderzobnin',
    },
    description: 'Zabbix plugin for Grafana',
    links: [
      {
        name: 'GitHub',
        url: 'https://github.com/alexanderzobnin/grafana-zabbix',
      },
      {
        name: 'Docs',
        url: 'https://alexanderzobnin.github.io/grafana-zabbix',
      },
      {
        name: 'License',
        url: 'https://github.com/alexanderzobnin/grafana-zabbix/blob/master/LICENSE',
      },
    ],
    logos: {
      small: 'public/plugins/alexanderzobnin-zabbix-app/img/icn-zabbix-app.svg',
      large: 'public/plugins/alexanderzobnin-zabbix-app/img/icn-zabbix-app.svg',
    },
    build: {
      time: 1629903250076,
      repo: 'git@github.com:alexanderzobnin/grafana-zabbix.git',
      hash: 'e9db978235cd6d01a095a37f3aa711ea8ea0f7ab',
    },
    screenshots: [
      {
        path: 'public/plugins/alexanderzobnin-zabbix-app/img/screenshot-showcase.png',
        name: 'Showcase',
      },
      {
        path: 'public/plugins/alexanderzobnin-zabbix-app/img/screenshot-dashboard01.png',
        name: 'Dashboard',
      },
      {
        path: 'public/plugins/alexanderzobnin-zabbix-app/img/screenshot-annotations.png',
        name: 'Annotations',
      },
      {
        path: 'public/plugins/alexanderzobnin-zabbix-app/img/screenshot-metric_editor.png',
        name: 'Metric Editor',
      },
      {
        path: 'public/plugins/alexanderzobnin-zabbix-app/img/screenshot-triggers.png',
        name: 'Triggers',
      },
    ],
    version: '4.2.2',
    updated: '2021-08-25',
  },
  hasUpdate: false,
  defaultNavUrl: '/plugins/alexanderzobnin-zabbix-app/',
  category: '',
  state: '',
  signature: 'valid',
  signatureType: 'community',
  signatureOrg: 'Alexander Zobnin',
  angularDetected: false,
} as LocalPlugin;
