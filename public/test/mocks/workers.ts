const mockWorker = {
  createWorker: () => ({
    postMessage: () => {},
  }),
};
jest.mock('../../app/plugins/panel/nodeGraph/createLayoutWorker', () => mockWorker);
jest.mock('../../app/features/live/centrifuge/createCentrifugeServiceWorker', () => mockWorker);
