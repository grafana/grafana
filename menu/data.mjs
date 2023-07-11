import React from 'react';
// ⚠️ import 时候需要指定扩展名，即加上 .js

const TENANT_ADMIN = 'TenantAdmin';
const PlatformAdmin = 'PlatformAdmin'; // 3
const SystemAdmin = 'SystemAdmin'; // 2

const data = [
  {
    id: 'grafana',
    type: 'all-product',
    text: 'Grafana',
    textEn: 'Grafana',
    column: 10,
    rankingInColumn: 20,
    children: [
      {
        id: 'grafana-1',
        text: 'Grafana',
        textEn: 'Grafana',
        children: [
          {
            id: 'grafana-home',
            text: 'Home',
            textEn: 'Home',
            pathname: '/',
          },
          {
            id: 'grafana-dashboards',
            text: 'Dashboards',
            textEn: 'Dashboards',
            children: [
              {
                id: 'grafana-dashboards-real',
                text: 'Dashboards',
                textEn: 'Dashboards',
                pathname: '/dashboards',
              },
              {
                id: 'grafana-dashboards-playlists',
                text: 'Playlists',
                textEn: 'Playlists',
                pathname: '/playlists',
              },
              {
                id: 'grafana-dashboards-snapshots',
                text: 'Snapshots',
                textEn: 'Snapshots',
                pathname: '/dashboard/snapshots',
              },
              {
                id: 'grafana-dashboards-library-panels',
                text: 'Library panels',
                textEn: 'Library panels',
                pathname: '/library-panels',
              },
            ],
          },
          {
            id: 'grafana-explore',
            text: 'Explore',
            textEn: 'Explore',
            pathname: '/explore',
          },
          {
            id: 'grafana-alerting',
            text: 'Alerting',
            textEn: 'Alerting',
            children: [
              {
                id: 'grafana-alerting-real',
                text: 'Alerting',
                textEn: 'Alerting',
                pathname: '/alerting',
              },
              {
                id: 'grafana-alerting-list',
                text: 'Alert rules',
                textEn: 'Alert rules',
                pathname: '/alerting/list',
              },
              {
                id: 'grafana-alerting-notifications',
                text: 'Contact points',
                textEn: 'Contact points',
                pathname: '/alerting/notifications',
              },
              {
                id: 'grafana-alerting-routes',
                text: 'Notification policies',
                textEn: 'Notification policies',
                pathname: '/alerting/routes',
              },
              {
                id: 'grafana-alerting-silences',
                text: 'Silences',
                textEn: 'Silences',
                pathname: '/alerting/silences',
              },
              {
                id: 'grafana-alerting-groups',
                text: 'Groups',
                textEn: 'Groups',
                pathname: '/alerting/groups',
              },
              {
                id: 'grafana-alerting-admin',
                text: 'Admin',
                textEn: 'Admin',
                pathname: '/alerting/admin',
              },
            ],
          },
          {
            id: 'grafana-connections',
            text: 'Connections',
            textEn: 'Connections',
            children: [
              {
                id: 'grafana-connections-add-new-connection',
                text: 'Add new connection',
                textEn: 'Add new connection',
                pathname: '/connections/add-new-connection',
              },
              {
                id: 'grafana-connections-datasources',
                text: 'Data sources',
                textEn: 'Data sources',
                pathname: '/connections/datasources',
              },
            ],
          },
          {
            id: 'grafana-admin',
            text: 'Administration',
            textEn: 'Administration',
            children: [
              {
                id: 'grafana-admin-real',
                text: 'Administration',
                textEn: 'Administration',
                pathname: '/admin',
              },
              {
                id: 'grafana-datasources',
                text: 'Data sources',
                textEn: 'Data sources',
                pathname: '/datasources',
              },
              {
                id: 'grafana-plugins',
                text: 'Plugins',
                textEn: 'Plugins',
                pathname: '/plugins',
              },
              {
                id: 'grafana-admin-users',
                text: 'Users',
                textEn: 'Users',
                pathname: '/admin/users',
              },
              {
                id: 'grafana-org-teams',
                text: 'Teams',
                textEn: 'Teams',
                pathname: '/org/teams',
              },
              {
                id: 'grafana-org-serviceaccounts',
                text: 'Service accounts',
                textEn: 'Service accounts',
                pathname: '/org/serviceaccounts',
              },
              {
                id: 'grafana-org',
                text: 'Default preferences',
                textEn: 'Default preferences',
                pathname: '/org',
              },
              {
                id: 'grafana-admin-settings',
                text: 'Settings',
                textEn: 'Settings',
                pathname: '/admin/settings',
              },
              {
                id: 'grafana-admin-orgs',
                text: 'Organizations',
                textEn: 'Organizations',
                pathname: '/admin/orgs',
              },
              {
                id: 'grafana-admin-upgrading',
                text: 'Stats and license',
                textEn: 'Stats and license',
                pathname: '/admin/upgrading',
              },
            ],
          },
        ],
      },
    ]
  },
];

export default data;
