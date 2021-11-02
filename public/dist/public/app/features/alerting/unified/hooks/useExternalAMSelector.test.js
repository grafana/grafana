import * as reactRedux from 'react-redux';
import { useExternalAmSelector } from './useExternalAmSelector';
var createMockStoreState = function (activeAlertmanagers, droppedAlertmanagers, alertmanagerConfig) { return ({
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
}); };
describe('useExternalAmSelector', function () {
    var useSelectorMock = jest.spyOn(reactRedux, 'useSelector');
    beforeEach(function () {
        useSelectorMock.mockClear();
    });
    it('should have one in pending', function () {
        useSelectorMock.mockImplementation(function (callback) {
            return callback(createMockStoreState([], [], ['some/url/to/am']));
        });
        var alertmanagers = useExternalAmSelector();
        expect(alertmanagers).toEqual([
            {
                url: 'some/url/to/am',
                status: 'pending',
                actualUrl: 'some/url/to/am/api/v2/alerts',
            },
        ]);
    });
    it('should have one active, one pending', function () {
        useSelectorMock.mockImplementation(function (callback) {
            return callback(createMockStoreState([{ url: 'some/url/to/am/api/v2/alerts' }], [], ['some/url/to/am', 'some/url/to/am1']));
        });
        var alertmanagers = useExternalAmSelector();
        expect(alertmanagers).toEqual([
            {
                url: 'some/url/to/am',
                actualUrl: 'some/url/to/am/api/v2/alerts',
                status: 'active',
            },
            {
                url: 'some/url/to/am1',
                actualUrl: 'some/url/to/am1/api/v2/alerts',
                status: 'pending',
            },
        ]);
    });
    it('should have two active', function () {
        useSelectorMock.mockImplementation(function (callback) {
            return callback(createMockStoreState([{ url: 'some/url/to/am/api/v2/alerts' }, { url: 'some/url/to/am1/api/v2/alerts' }], [], ['some/url/to/am', 'some/url/to/am1']));
        });
        var alertmanagers = useExternalAmSelector();
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
    it('should have one active, one dropped, one pending', function () {
        useSelectorMock.mockImplementation(function (callback) {
            return callback(createMockStoreState([{ url: 'some/url/to/am/api/v2/alerts' }], [{ url: 'some/dropped/url/api/v2/alerts' }], ['some/url/to/am', 'some/url/to/am1']));
        });
        var alertmanagers = useExternalAmSelector();
        expect(alertmanagers).toEqual([
            {
                url: 'some/url/to/am',
                actualUrl: 'some/url/to/am/api/v2/alerts',
                status: 'active',
            },
            {
                url: 'some/url/to/am1',
                actualUrl: 'some/url/to/am1/api/v2/alerts',
                status: 'pending',
            },
            {
                url: 'some/dropped/url',
                actualUrl: 'some/dropped/url/api/v2/alerts',
                status: 'dropped',
            },
        ]);
    });
});
//# sourceMappingURL=useExternalAMSelector.test.js.map