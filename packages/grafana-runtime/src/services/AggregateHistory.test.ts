import * as H from 'history';
import { createAggregateHistory } from './AggregateHistory';

function createHistoryMock(): H.History {
  return {
    length: 0,
    action: 'POP',
    location: {
      pathname: '/',
      search: '',
      state: {},
      hash: '',
      key: '',
    },
    push: jest.fn(),
    replace: jest.fn(),
    go: jest.fn(),
    goBack: jest.fn(),
    goForward: jest.fn(),
    listen: jest.fn(),
    block: jest.fn(),
    createHref: jest.fn(),
  };
}

describe('createAggregateHistory', () => {
  it('can change main history when no secondary is present', () => {
    const history = createHistoryMock();
    const aggregateHistory = createAggregateHistory({ actualHistory: history, isMain: true, param: '__sc' });

    aggregateHistory.push('/test');
    expect(history.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/test' }), undefined);

    aggregateHistory.replace('/test');
    expect(history.replace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/test' }), undefined);
  });

  it('can change secondary history', () => {
    const history = createHistoryMock();
    const aggregateHistory = createAggregateHistory({ actualHistory: history, isMain: false, param: '__sc' });

    aggregateHistory.push('/test');
    expect(history.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/', search: '__sc=%2Ftest' }),
      undefined
    );

    aggregateHistory.replace('/test');
    expect(history.replace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/', search: '__sc=%2Ftest' }),
      undefined
    );
  });

  it('can alter both', () => {
    const history = createHistoryMock();
    history.location.pathname = '/a/logs-app/logs';
    history.location.search = 'id=12345&namespace=default&__sc=%2Fa%2Ftraces-app%2Ftrace';
    const aggregateHistoryMain = createAggregateHistory({ actualHistory: history, isMain: true, param: '__sc' });
    const aggregateHistorySecondary = createAggregateHistory({ actualHistory: history, isMain: false, param: '__sc' });

    aggregateHistoryMain.push('/a/profiles-app/profiles?namespace=app');
    expect(history.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/a/profiles-app/profiles',
        search: 'namespace=app&__sc=%2Fa%2Ftraces-app%2Ftrace',
      }),
      undefined
    );

    aggregateHistorySecondary.push('/a/profiles-app/profiles?namespace=app');
    expect(history.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/a/logs-app/logs',
        search: 'id=12345&namespace=default&__sc=%2Fa%2Fprofiles-app%2Fprofiles%3Fnamespace%3Dapp',
      }),
      undefined
    );
  });
});
