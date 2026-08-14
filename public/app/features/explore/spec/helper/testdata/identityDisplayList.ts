export const getIdentityDisplayList = () => ({
  kind: 'DisplayList',
  apiVersion: 'iam.grafana.app/v0alpha1',
  metadata: {},
  keys: ['user:u000000001', 'user:u000000002'],
  display: [
    {
      identity: {
        type: 'user',
        name: 'u000000001',
      },
      displayName: 'Test User1',
      avatarURL: '/avatar/46d229b033af06a191ff2267bca9ae56',
      internalId: 1,
    },
    {
      identity: {
        type: 'user',
        name: 'u000000002',
      },
      displayName: 'Test User2',
      avatarURL: '/avatar/24c9e15e52afc47c225b757e7bee1f9d',
      internalId: 2,
    },
  ],
});
