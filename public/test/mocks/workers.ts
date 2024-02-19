class BasicMockWorker {
  postMessage() {}
}
const mockCreateWorker = {
  createWorker: () => new BasicMockWorker(),
};

jest.mock('../../app/features/live/centrifuge/createCentrifugeServiceWorker', () => mockCreateWorker);
