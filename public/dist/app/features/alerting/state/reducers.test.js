import { ActionTypes } from './actions';
import { alertRulesReducer, initialState } from './reducers';
describe('Alert rules', function () {
    var payload = [
        {
            id: 2,
            dashboardId: 7,
            dashboardUid: 'ggHbN42mk',
            dashboardSlug: 'alerting-with-testdata',
            panelId: 4,
            name: 'TestData - Always Alerting',
            state: 'alerting',
            newStateDate: '2018-09-04T10:00:30+02:00',
            evalDate: '0001-01-01T00:00:00Z',
            evalData: { evalMatches: [{ metric: 'A-series', tags: null, value: 215 }] },
            executionError: '',
            url: '/d/ggHbN42mk/alerting-with-testdata',
        },
        {
            id: 1,
            dashboardId: 7,
            dashboardUid: 'ggHbN42mk',
            dashboardSlug: 'alerting-with-testdata',
            panelId: 3,
            name: 'TestData - Always OK',
            state: 'ok',
            newStateDate: '2018-09-04T10:01:01+02:00',
            evalDate: '0001-01-01T00:00:00Z',
            evalData: {},
            executionError: '',
            url: '/d/ggHbN42mk/alerting-with-testdata',
        },
        {
            id: 3,
            dashboardId: 7,
            dashboardUid: 'ggHbN42mk',
            dashboardSlug: 'alerting-with-testdata',
            panelId: 3,
            name: 'TestData - ok',
            state: 'ok',
            newStateDate: '2018-09-04T10:01:01+02:00',
            evalDate: '0001-01-01T00:00:00Z',
            evalData: {},
            executionError: 'error',
            url: '/d/ggHbN42mk/alerting-with-testdata',
        },
        {
            id: 4,
            dashboardId: 7,
            dashboardUid: 'ggHbN42mk',
            dashboardSlug: 'alerting-with-testdata',
            panelId: 3,
            name: 'TestData - Paused',
            state: 'paused',
            newStateDate: '2018-09-04T10:01:01+02:00',
            evalDate: '0001-01-01T00:00:00Z',
            evalData: {},
            executionError: 'error',
            url: '/d/ggHbN42mk/alerting-with-testdata',
        },
        {
            id: 5,
            dashboardId: 7,
            dashboardUid: 'ggHbN42mk',
            dashboardSlug: 'alerting-with-testdata',
            panelId: 3,
            name: 'TestData - Ok',
            state: 'ok',
            newStateDate: '2018-09-04T10:01:01+02:00',
            evalDate: '0001-01-01T00:00:00Z',
            evalData: {
                noData: true,
            },
            executionError: 'error',
            url: '/d/ggHbN42mk/alerting-with-testdata',
        },
    ];
    it('should set alert rules', function () {
        var action = {
            type: ActionTypes.LoadedAlertRules,
            payload: payload,
        };
        var result = alertRulesReducer(initialState, action);
        expect(result.items).toEqual(payload);
    });
});
//# sourceMappingURL=reducers.test.js.map