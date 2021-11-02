import { FieldColorModeId, FieldConfigProperty, FieldMatcherID } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';
import { PieChartPanelChangedHandler } from './migrations';
import { PieChartLabels } from './types';
describe('PieChart -> PieChartV2 migrations', function () {
    it('only migrates old piechart', function () {
        var panel = {};
        var options = PieChartPanelChangedHandler(panel, 'some-panel-id', {});
        expect(options).toEqual({});
    });
    it('correctly assigns color overrides', function () {
        var panel = { options: {} };
        var oldPieChartOptions = {
            angular: {
                aliasColors: { x: '#fff' },
            },
        };
        PieChartPanelChangedHandler(panel, 'grafana-piechart-panel', oldPieChartOptions);
        expect(panel.fieldConfig.overrides).toContainEqual({
            matcher: {
                id: FieldMatcherID.byName,
                options: 'x',
            },
            properties: [
                {
                    id: FieldConfigProperty.Color,
                    value: {
                        mode: FieldColorModeId.Fixed,
                        fixedColor: '#fff',
                    },
                },
            ],
        });
    });
    it('correctly sets sum calculation', function () {
        var panel = { options: {} };
        var oldPieChartOptions = {
            angular: { valueName: 'total' },
        };
        var options = PieChartPanelChangedHandler(panel, 'grafana-piechart-panel', oldPieChartOptions);
        expect(options).toMatchObject({ reduceOptions: { calcs: ['sum'] } });
    });
    it('correctly sets labels when old PieChart has legend on graph', function () {
        var panel = { options: {} };
        var oldPieChartOptions = {
            angular: {
                legendType: 'On graph',
                legend: { values: true },
            },
        };
        var options = PieChartPanelChangedHandler(panel, 'grafana-piechart-panel', oldPieChartOptions);
        expect(options).toMatchObject({ displayLabels: [PieChartLabels.Name, PieChartLabels.Value] });
    });
    it('hides the legend when no legend values are selected', function () {
        var panel = { options: {} };
        var oldPieChartOptions = {
            angular: {
                legendType: 'On graph',
                legend: {},
            },
        };
        var options = PieChartPanelChangedHandler(panel, 'grafana-piechart-panel', oldPieChartOptions);
        expect(options).toMatchObject({ legend: { displayMode: LegendDisplayMode.Hidden } });
    });
});
//# sourceMappingURL=migrations.test.js.map