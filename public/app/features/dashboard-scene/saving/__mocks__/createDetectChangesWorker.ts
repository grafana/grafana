const worker = {
  postMessage: jest.fn(),
  onmessage: jest.fn(),
  terminate: jest.fn(),
};

jest.mocked(worker.postMessage).mockImplementation(({ generation }) => {
  worker.onmessage?.({
    data: {
      hasChanges: true,
      generation,
    },
  } as unknown as MessageEvent);
});

const createWorker = () => worker;

export { createWorker };
