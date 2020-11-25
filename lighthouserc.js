module.exports = {
  ci: {
    collect: {
      startServerCommand: './bin/grafana-server',
      url: ['http://localhost:3000'],
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
