export const useAppNotification = jest.fn(() => ({
  success: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));
