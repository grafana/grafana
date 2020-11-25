module.exports = {
  ci: {
    collect: {
      startServerCommand: './e2e/start-server',
      url: ['http://localhost'],
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
