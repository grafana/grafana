module.exports = {
  managerEntries(entry = []) {
    return [...entry, require.resolve('./register')];
  },
};
