import { getAppPluginMetas } from '@grafana/runtime/internal';

import { log } from '../logs/log';

import { getPluginExtensionRegistries, setPluginExtensionRegistries } from './setup';

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getAppPluginMetas: jest.fn(),
}));

const getAppPluginMetasMock = jest.mocked(getAppPluginMetas);

describe('getPluginExtensionRegistries', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => {
    setPluginExtensionRegistries();
    jest.resetAllMocks();
    getAppPluginMetasMock.mockResolvedValue([]);
    logSpy = jest.spyOn(log, 'error');
  });

  test('should only call getAppPluginMetas once', async () => {
    const promise1 = getPluginExtensionRegistries();
    const promise2 = getPluginExtensionRegistries();

    await Promise.all([promise1, promise2]);

    expect(getAppPluginMetasMock).toHaveBeenCalledTimes(1);
  });

  test('should return the same promise instance for concurrent calls', async () => {
    const promise1 = getPluginExtensionRegistries();
    const promise2 = getPluginExtensionRegistries();
    const promise3 = getPluginExtensionRegistries();

    expect(promise1).toStrictEqual(promise2);
    expect(promise2).toStrictEqual(promise3);
    expect(promise3).toStrictEqual(promise1);

    const [first, second, third] = await Promise.all([promise1, promise2, promise3]);

    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(third).toBe(first);
  });

  test('should not cache promise if getAppPluginMetas throws', async () => {
    getAppPluginMetasMock.mockRejectedValueOnce(new Error('Some error'));

    const first = await getPluginExtensionRegistries();
    const second = await getPluginExtensionRegistries();
    const third = await getPluginExtensionRegistries();

    expect(getAppPluginMetasMock).toHaveBeenCalledTimes(2); // first + second (because first throws), third is cached
    expect(first).not.toBe(second);
    expect(first).not.toBe(third);
    expect(second).toBe(third);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('Failed to init plugin extension registries.', {
      message: 'Some error',
      stack: expect.any(String),
    });
  });
});
