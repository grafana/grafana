import { useExternalAmSelector } from './useExternalAmSelector';

jest.mock('react-redux', () => ({
  ...(jest.requireActual('react-redux') as any),
  useSelector: jest.fn().mockImplementation((callback) => {
    return callback(mockStoreState);
  }),
}));

const mockStoreState = {
  unifiedAlerting: {
    externalAlertmanagers: {
      activeAlertmanagers: {
        result: {
          data: {
            activeAlertManagers: [{ url: 'some/url/to/am/api/v2/alerts' }, { url: 'some/url/to/am1/api/v2/alerts' }],
            droppedAlertManagers: [],
          },
        },
      },
      alertmanagerConfig: {
        result: {
          alertmanagers: ['some/url/to/am', 'some/url/to/am1', 'some/url/to/am4'],
        },
      },
    },
  },
};

describe('useExternalAmSelector', () => {
  it('should return', () => {
    const alertmanagers = useExternalAmSelector();

    expect(alertmanagers).toEqual([
      {
        url: 'some/url/to/am/api/v2/alerts',
        status: 'active',
      },
      {
        url: 'some/url/to/am1/api/v2/alerts',
        status: 'active',
      },
      {
        url: 'some/url/to/am4',
        status: 'pending',
      },
    ]);
  });
});
