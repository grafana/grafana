const mockAppEvents = {
  subscribe: jest.fn(),
  publish: jest.fn(),
  removeAllListeners: jest.fn(),
  getStream: jest.fn(),
  removeListener: jest.fn(),
  on: jest.fn(),
  emit: jest.fn(),
  off: jest.fn(),
};

export const appEvents = mockAppEvents;
export default mockAppEvents;
