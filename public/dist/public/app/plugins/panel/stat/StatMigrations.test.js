import { statPanelChangedHandler } from './StatMigrations';
import { BigValueGraphMode, BigValueColorMode } from '@grafana/ui';
import { BigValueTextMode } from '@grafana/ui/src/components/BigValue/BigValue';
describe('Stat Panel Migrations', function () {
    it('change from angular singlestat sparkline disabled', function () {
        var old = {
            angular: {
                format: 'ms',
                decimals: 7,
                sparkline: {
                    show: false,
                },
            },
        };
        var panel = {};
        var options = statPanelChangedHandler(panel, 'singlestat', old);
        expect(options.graphMode).toBe(BigValueGraphMode.None);
    });
    it('change from angular singlestat sparkline enabled', function () {
        var old = {
            angular: {
                format: 'ms',
                decimals: 7,
                sparkline: {
                    show: true,
                },
            },
        };
        var panel = {};
        var options = statPanelChangedHandler(panel, 'singlestat', old);
        expect(options.graphMode).toBe(BigValueGraphMode.Area);
    });
    it('change from angular singlestat color background', function () {
        var old = {
            angular: {
                format: 'ms',
                decimals: 7,
                colorBackground: true,
            },
        };
        var panel = {};
        var options = statPanelChangedHandler(panel, 'singlestat', old);
        expect(options.colorMode).toBe(BigValueColorMode.Background);
    });
    it('change from angular singlestat with name stat', function () {
        var old = {
            angular: {
                valueName: 'name',
            },
        };
        var panel = {};
        var options = statPanelChangedHandler(panel, 'singlestat', old);
        expect(options.textMode).toBe(BigValueTextMode.Name);
    });
    it('use no color unless one was configured', function () {
        var old = {
            angular: {
                valueName: 'name',
            },
        };
        var panel = {};
        var options = statPanelChangedHandler(panel, 'singlestat', old);
        expect(options.colorMode).toBe(BigValueColorMode.None);
        old = {
            angular: {
                valueName: 'name',
                colorBackground: true,
            },
        };
        panel = {};
        options = statPanelChangedHandler(panel, 'singlestat', old);
        expect(options.colorMode).toBe(BigValueColorMode.Background);
    });
});
//# sourceMappingURL=StatMigrations.test.js.map