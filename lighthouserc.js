module.exports = {
  ci: {
    collect: {
      startServerCommand: './bin/grafana-server',
      url: ['http://localhost:3000'],
      puppeteerScript: './scripts/lighthouse/fake-login.js',
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
