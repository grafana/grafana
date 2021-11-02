import { __assign } from "tslib";
import React from 'react';
import { LoadingState, toUtc, CoreApp, createTheme, } from '@grafana/data';
import { ExploreId } from 'app/types/explore';
import { shallow } from 'enzyme';
import { Explore } from './Explore';
import { scanStopAction } from './state/query';
import { SecondaryActions } from './SecondaryActions';
var dummyProps = {
    logsResult: undefined,
    changeSize: jest.fn(),
    datasourceInstance: {
        meta: {
            metrics: true,
            logs: true,
        },
        components: {
            QueryEditorHelp: {},
        },
    },
    datasourceMissing: false,
    exploreId: ExploreId.left,
    loading: false,
    modifyQueries: jest.fn(),
    scanStart: jest.fn(),
    scanStopAction: scanStopAction,
    setQueries: jest.fn(),
    queryKeys: [],
    isLive: false,
    syncedTimes: false,
    updateTimeRange: jest.fn(),
    graphResult: [],
    absoluteRange: {
        from: 0,
        to: 0,
    },
    timeZone: 'UTC',
    queryResponse: {
        state: LoadingState.NotStarted,
        series: [],
        request: {
            requestId: '1',
            dashboardId: 0,
            interval: '1s',
            panelId: 1,
            scopedVars: {
                apps: {
                    value: 'value',
                },
            },
            targets: [
                {
                    refId: 'A',
                },
            ],
            timezone: 'UTC',
            app: CoreApp.Explore,
            startTime: 0,
        },
        error: {},
        timeRange: {
            from: toUtc('2019-01-01 10:00:00'),
            to: toUtc('2019-01-01 16:00:00'),
            raw: {
                from: 'now-6h',
                to: 'now',
            },
        },
    },
    addQueryRow: jest.fn(),
    theme: createTheme(),
    showMetrics: true,
    showLogs: true,
    showTable: true,
    showTrace: true,
    showNodeGraph: true,
    splitOpen: (function () { }),
    logsVolumeData: undefined,
    loadLogsVolumeData: function () { },
    changeGraphStyle: function () { },
    graphStyle: 'lines',
};
describe('Explore', function () {
    it('should render component', function () {
        var wrapper = shallow(React.createElement(Explore, __assign({}, dummyProps)));
        expect(wrapper).toMatchSnapshot();
    });
    it('renders SecondaryActions and add row button', function () {
        var wrapper = shallow(React.createElement(Explore, __assign({}, dummyProps)));
        expect(wrapper.find(SecondaryActions)).toHaveLength(1);
        expect(wrapper.find(SecondaryActions).props().addQueryRowButtonHidden).toBe(false);
    });
});
//# sourceMappingURL=Explore.test.js.map