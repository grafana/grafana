import { attachDebugger, createLogger } from '@grafana/ui/debug';

jest.mock('@grafana/ui', () => {
  throw new Error('The debug entry point must not load the UI barrel');
});

afterEach(() => {
  const debuggerGlobal = Reflect.get(window, '_debug');
  if (debuggerGlobal) {
    Reflect.deleteProperty(debuggerGlobal, 'narrowEntryPoint');
  }
});

it('provides working debug helpers without importing the UI barrel', () => {
  const logger = createLogger('narrow');
  logger.enable();
  expect(logger.isEnabled()).toBe(true);

  attachDebugger('narrowEntryPoint', { source: 'narrow' }, logger);
  expect(window).toHaveProperty('_debug.narrowEntryPoint', {
    source: 'narrow',
    enable: expect.any(Function),
    disable: expect.any(Function),
  });

  logger.disable();
  expect(logger.isEnabled()).toBe(false);
});
