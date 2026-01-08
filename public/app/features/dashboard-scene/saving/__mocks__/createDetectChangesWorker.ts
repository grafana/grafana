const worker = {
  postMessage: jest.fn(),
  onmessage: jest.fn(),
  terminate: jest.fn(),
};

jest.mocked(worker.postMessage).mockImplementation(() => {
  worker.onmessage?.({
    data: {
      hasChanges: true,
    },
  } as unknown as MessageEvent);
});

const createWorker = () => worker;

export { createWorker };
