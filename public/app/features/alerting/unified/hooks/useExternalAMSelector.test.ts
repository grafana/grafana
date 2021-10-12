import * as reactRedux from 'react-redux';
import { useExternalAmSelector } from './useExternalAmSelector';

const createMockStoreState = (
  activeAlertManagers: Array<{ url: string }>,
  droppedAlertManagers: Array<{ url: string }>,
  alertmanagerConfig: string[]
) => ({
  unifiedAlerting: {
    externalAlertmanagers: {
      activeAlertmanagers: {
        result: {
          data: {
            activeAlertManagers: activeAlertManagers,
            droppedAlertManagers: droppedAlertManagers,
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
        url: 'some/url/to/am/api/v2/alerts',
        status: 'pending',
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
        url: 'some/url/to/am/api/v2/alerts',
        status: 'active',
      },
      {
        url: 'some/url/to/am1/api/v2/alerts',
        status: 'pending',
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
        url: 'some/url/to/am/api/v2/alerts',
        status: 'active',
      },
      {
        url: 'some/url/to/am1/api/v2/alerts',
        status: 'pending',
      },
      {
        url: 'some/dropped/url/api/v2/alerts',
        status: 'dropped',
      },
    ]);
  });
});
