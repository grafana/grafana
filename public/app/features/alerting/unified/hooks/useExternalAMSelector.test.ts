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
      return callback(createMockStoreState([], [], ['some/url/to/am']));
    });
    const alertmanagers = useExternalAmSelector();

    expect(alertmanagers).toEqual([
      {
        url: 'some/url/to/am',
        status: 'pending',
        actualUrl: '',
      },
    ]);
  });

  it('should have one active, one pending', () => {
    useSelectorMock.mockImplementation((callback) => {
      return callback(
        createMockStoreState([{ url: 'some/url/to/am/api/v2/alerts' }], [], ['some/url/to/am', 'some/url/to/am1'])
      );
    });

    const alertmanagers = useExternalAmSelector();

    expect(alertmanagers).toEqual([
      {
        url: 'some/url/to/am',
        actualUrl: 'some/url/to/am/api/v2/alerts',
        status: 'active',
      },
      {
        url: 'some/url/to/am1',
        actualUrl: '',
        status: 'pending',
      },
    ]);
  });

  it('should have two active', () => {
    useSelectorMock.mockImplementation((callback) => {
      return callback(
        createMockStoreState(
          [{ url: 'some/url/to/am/api/v2/alerts' }, { url: 'some/url/to/am1/api/v2/alerts' }],
          [],
          ['some/url/to/am', 'some/url/to/am1']
        )
      );
    });

    const alertmanagers = useExternalAmSelector();

    expect(alertmanagers).toEqual([
      {
        url: 'some/url/to/am',
        actualUrl: 'some/url/to/am/api/v2/alerts',
        status: 'active',
      },
      {
        url: 'some/url/to/am1',
        actualUrl: 'some/url/to/am1/api/v2/alerts',
        status: 'active',
      },
    ]);
  });

  it('should have one active, one dropped, one pending', () => {
    useSelectorMock.mockImplementation((callback) => {
      return callback(
        createMockStoreState(
          [{ url: 'some/url/to/am/api/v2/alerts' }],
          [{ url: 'some/dropped/url/api/v2/alerts' }],
          ['some/url/to/am', 'some/url/to/am1']
        )
      );
    });

    const alertmanagers = useExternalAmSelector();

    expect(alertmanagers).toEqual([
      {
        url: 'some/url/to/am',
        actualUrl: 'some/url/to/am/api/v2/alerts',
        status: 'active',
      },
      {
        url: 'some/url/to/am1',
        actualUrl: '',
        status: 'pending',
      },
      {
        url: 'some/dropped/url',
        actualUrl: 'some/dropped/url/api/v2/alerts',
        status: 'dropped',
      },
    ]);
  });

  it('The number of alert managers should match config entries when there are multiple entries of the same url', () => {
    useSelectorMock.mockImplementation((callback) => {
      return callback(
        createMockStoreState(
          [
            { url: 'same/url/to/am/api/v2/alerts' },
            { url: 'same/url/to/am/api/v2/alerts' },
            { url: 'same/url/to/am/api/v2/alerts' },
          ],
          [],
          ['same/url/to/am', 'same/url/to/am', 'same/url/to/am']
        )
      );
    });

    const alertmanagers = useExternalAmSelector();

    expect(alertmanagers.length).toBe(3);
    expect(alertmanagers).toEqual([
      {
        url: 'same/url/to/am',
        actualUrl: 'same/url/to/am/api/v2/alerts',
        status: 'active',
      },
      {
        url: 'same/url/to/am',
        actualUrl: 'same/url/to/am/api/v2/alerts',
        status: 'active',
      },
      {
        url: 'same/url/to/am',
        actualUrl: 'same/url/to/am/api/v2/alerts',
        status: 'active',
      },
    ]);
  });
});
