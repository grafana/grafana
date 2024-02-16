const worker = {
  postMessage: jest.fn(),
  onmessage: jest.fn(),
  terminate: jest.fn(),
};

const createWorker = () => worker;

export { createWorker };
