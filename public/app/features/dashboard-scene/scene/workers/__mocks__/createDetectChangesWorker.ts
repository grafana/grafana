const worker = {
  postMessage: jest.fn(),
  onmessage: jest.fn(),
  terminate: jest.fn(),
};

jest.mocked(worker.postMessage).mockImplementation(() => {
  worker.onmessage?.({
    hasChanges: true,
    hasTimeChanges: false,
    hasVariableValueChanges: false,
  } as unknown as MessageEvent);
});

const createWorker = () => worker;

export { createWorker };
