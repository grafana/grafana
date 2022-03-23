import * as reactRedux from 'react-redux';
import { useExternalAmSelector } from './useExternalAmSelector';

const createMockStoreState = (
  activeAlertmanagers: Array<{ url: string }>,
  droppedAlertmanagers: Array<{ url: string }>,
  alertmanagerConfig: string[]
) => ({
  unifiedAlerting: {
    externalAlertmanagers: {
      discoveredAlertmanagers: {
        result: {
          data: {
            activeAlertManagers: activeAlertmanagers,
            droppedAlertManagers: droppedAlertmanagers,
          },
        },
      },
      alertmanagerConfig: {
        result: {
          alertmanagers: alertmanagerConfig,
        },
      },
    },
  },
});

describe('useExternalAmSelector', () => {
  const useSelectorMock = jest.spyOn(reactRedux, 'useSelector');
  beforeEach(() => {
    useSelectorMock.mockClear();
  });
  it('should have one in pending', () => {
    useSelectorMock.mockImplementation((callback) => {
      return callback(createMockStoreState([], [], ['http://localhost:9000/some/url/to/am']));
    });
    const alertmanagers = useExternalAmSelector();

    expect(alertmanagers).toEqual([
      {
        url: 'http://localhost:9000/some/url/to/am',
        status: 'pending',
        actualUrl: '',
      },
    ]);
  });

  it('should have one active, one pending', () => {
    useSelectorMock.mockImplementation((callback) => {
      return callback(
        createMockStoreState(
          [{ url: 'http://localhost:9000/some/url/to/am/api/v2/alerts' }],
          [],
          ['http://localhost:9000/some/url/to/am', 'http://localhost:9000/some/url/to/am1']
        )
      );
    });

    const alertmanagers = useExternalAmSelector();

    expect(alertmanagers).toEqual([
      {
        url: 'http://localhost:9000/some/url/to/am',
        actualUrl: 'http://localhost:9000/some/url/to/am',
        status: 'active',
      },
      {
        url: 'http://localhost:9000/some/url/to/am1',
        actualUrl: '',
        status: 'pending',
      },
    ]);
  });

  it('should have two active', () => {
    useSelectorMock.mockImplementation((callback) => {
      return callback(
        createMockStoreState(
          [
            { url: 'http://localhost:9000/some/url/to/am/api/v2/alerts' },
            { url: 'http://localhost:9000/some/url/to/am1/api/v2/alerts' },
          ],
          [],
          ['http://localhost:9000/some/url/to/am', 'http://localhost:9000/some/url/to/am1']
        )
      );
    });

    const alertmanagers = useExternalAmSelector();

    expect(alertmanagers).toEqual([
      {
        url: 'http://localhost:9000/some/url/to/am',
        actualUrl: 'http://localhost:9000/some/url/to/am',
        status: 'active',
      },
      {
        url: 'http://localhost:9000/some/url/to/am1',
        actualUrl: 'http://localhost:9000/some/url/to/am1',
        status: 'active',
      },
    ]);
  });

  it('should have one active, one dropped, one pending', () => {
    useSelectorMock.mockImplementation((callback) => {
      return callback(
        createMockStoreState(
          [{ url: 'http://localhost:9000/some/url/to/am/api/v2/alerts' }],
          [{ url: 'http://localhost:9000/some/dropped/url/api/v2/alerts' }],
          ['http://localhost:9000/some/url/to/am', 'http://localhost:9000/some/url/to/am1']
        )
      );
    });

    const alertmanagers = useExternalAmSelector();

    expect(alertmanagers).toEqual([
      {
        url: 'http://localhost:9000/some/url/to/am',
        actualUrl: 'http://localhost:9000/some/url/to/am',
        status: 'active',
      },
      {
        url: 'http://localhost:9000/some/url/to/am1',
        actualUrl: '',
        status: 'pending',
      },
      {
        url: 'http://localhost:9000/some/dropped/url',
        actualUrl: 'http://localhost:9000/some/dropped/url/api/v2/alerts',
        status: 'dropped',
      },
    ]);
  });

  it('should match urls by host and path and ignore other parts', () => {
    useSelectorMock.mockImplementation((callback) => {
      return callback(
        createMockStoreState(
          [{ url: 'http://localhost:9000/some/url/to/am/api/v2/alerts' }],
          [],
          ['http://user:password@localhost:9000/some/url/to/am']
        )
      );
    });

    const alertmanagers = useExternalAmSelector();

    expect(alertmanagers).toEqual([
      {
        url: 'http://localhost:9000/some/url/to/am',
        actualUrl: 'http://user:password@localhost:9000/some/url/to/am',
        status: 'active',
      },
    ]);
  });
});
