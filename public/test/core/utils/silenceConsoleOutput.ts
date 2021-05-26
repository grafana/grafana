export const silenceConsoleOutput = () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(jest.fn());
    jest.spyOn(console, 'error').mockImplementation(jest.fn());
    jest.spyOn(console, 'debug').mockImplementation(jest.fn());
    jest.spyOn(console, 'info').mockImplementation(jest.fn());
    jest.spyOn(console, 'warn').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.spyOn(console, 'log').mockRestore();
    jest.spyOn(console, 'error').mockRestore();
    jest.spyOn(console, 'debug').mockRestore();
    jest.spyOn(console, 'info').mockRestore();
    jest.spyOn(console, 'warn').mockRestore();
  });
};
