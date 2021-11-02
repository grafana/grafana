import { dateTime } from '@grafana/data';
import { applyPanelTimeOverrides, calculateInnerPanelHeight } from 'app/features/dashboard/utils/panel';
import { advanceTo, clear } from 'jest-date-mock';
import { PanelModel } from '../state';
import { getPanelPlugin } from '../../plugins/__mocks__/pluginMocks';
var dashboardTimeRange = {
    from: dateTime([2019, 1, 11, 12, 0]),
    to: dateTime([2019, 1, 11, 18, 0]),
    raw: {
        from: 'now-6h',
        to: 'now',
    },
};
describe('applyPanelTimeOverrides', function () {
    var fakeCurrentDate = dateTime([2019, 1, 11, 14, 0, 0]).toDate();
    beforeAll(function () {
        advanceTo(fakeCurrentDate);
    });
    afterAll(function () {
        clear();
    });
    it('should apply relative time override', function () {
        var panelModel = {
            timeFrom: '2h',
        };
        // @ts-ignore: PanelModel type inconsistency
        var overrides = applyPanelTimeOverrides(panelModel, dashboardTimeRange);
        expect(overrides.timeRange.from.toISOString()).toBe(dateTime([2019, 1, 11, 12]).toISOString());
        expect(overrides.timeRange.to.toISOString()).toBe(fakeCurrentDate.toISOString());
        expect(overrides.timeRange.raw.from).toBe('now-2h');
        expect(overrides.timeRange.raw.to).toBe('now');
    });
    it('should apply time shift', function () {
        var panelModel = {
            timeShift: '2h',
        };
        var expectedFromDate = dateTime([2019, 1, 11, 10, 0, 0]).toDate();
        var expectedToDate = dateTime([2019, 1, 11, 16, 0, 0]).toDate();
        // @ts-ignore: PanelModel type inconsistency
        var overrides = applyPanelTimeOverrides(panelModel, dashboardTimeRange);
        expect(overrides.timeRange.from.toISOString()).toBe(expectedFromDate.toISOString());
        expect(overrides.timeRange.to.toISOString()).toBe(expectedToDate.toISOString());
        expect(overrides.timeRange.raw.from.toISOString()).toEqual(expectedFromDate.toISOString());
        expect(overrides.timeRange.raw.to.toISOString()).toEqual(expectedToDate.toISOString());
    });
    it('should apply both relative time and time shift', function () {
        var panelModel = {
            timeFrom: '2h',
            timeShift: '2h',
        };
        var expectedFromDate = dateTime([2019, 1, 11, 10, 0, 0]).toDate();
        var expectedToDate = dateTime([2019, 1, 11, 12, 0, 0]).toDate();
        // @ts-ignore: PanelModel type inconsistency
        var overrides = applyPanelTimeOverrides(panelModel, dashboardTimeRange);
        expect(overrides.timeRange.from.toISOString()).toBe(expectedFromDate.toISOString());
        expect(overrides.timeRange.to.toISOString()).toBe(expectedToDate.toISOString());
        expect(overrides.timeRange.raw.from.toISOString()).toEqual(expectedFromDate.toISOString());
        expect(overrides.timeRange.raw.to.toISOString()).toEqual(expectedToDate.toISOString());
    });
    it('Calculate panel height', function () {
        var panelModel = new PanelModel({});
        var height = calculateInnerPanelHeight(panelModel, 100);
        expect(height).toBe(82);
    });
    it('Calculate panel height with panel plugin zeroChromePadding', function () {
        var panelModel = new PanelModel({});
        panelModel.pluginLoaded(getPanelPlugin({ id: 'table' }, null, null).setNoPadding());
        var height = calculateInnerPanelHeight(panelModel, 100);
        expect(height).toBe(98);
    });
});
//# sourceMappingURL=panel.test.js.map