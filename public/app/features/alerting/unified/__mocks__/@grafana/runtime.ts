const original = jest.requireActual<typeof import('@grafana/runtime')>('@grafana/runtime');

module.exports = {
  __esModule: true,
  ...original,
  useReturnToPrevious: jest.fn(),
  getPluginLinkExtensions: jest.fn(),
  usePluginLinkExtensions: jest.fn(),
};
