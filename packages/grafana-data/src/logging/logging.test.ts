import { frontendLogging } from './LogManager';
import { ArrayAppender, LogLevel } from './types';

let testAppender = new ArrayAppender();
frontendLogging.registerAppender('test', testAppender);
frontendLogging.removeAppender('console');

describe('Logging', () => {
  beforeEach(() => {
    frontendLogging.updateConfig({ loggers: {} });
    testAppender.clear();
  });

  it('Should not log by default', () => {
    const logger = frontendLogging.getLogger('test');
    logger.debug('hello');

    expect(testAppender.logs.length).toBe(0);

    // Update config to enable debug logging
    frontendLogging.updateConfig({ loggers: { ['test']: LogLevel.Debug } });

    logger.debug('hello');

    expect(testAppender.logs[0]).toEqual('[DEBUG] test: hello');

    // Test that we can clear the config
    frontendLogging.updateConfig({ loggers: {} });

    logger.debug('hello');

    expect(testAppender.logs.length).toBe(1);
  });

  it('Should inherit log level', () => {
    const parent = frontendLogging.getLogger('parent');
    const child = frontendLogging.getLogger('parent/child');

    parent.setLevel(LogLevel.Debug);

    child.debug('hello');

    expect(testAppender.logs.length).toBe(1);

    child.setLevel(LogLevel.Off);
    child.debug('hello');

    expect(testAppender.logs.length).toBe(1);
  });

  it('Can set logger level using string', () => {
    const logger = frontendLogging.getLogger('logger');
    frontendLogging.setLoggerLevel('logger', 'debug');

    logger.debug('hello');

    expect(testAppender.logs.length).toBe(1);
  });
});
