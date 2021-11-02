/** @internal */
export function createBreakpoints() {
    var step = 5;
    var keys = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
    var unit = 'px';
    var values = {
        xs: 0,
        sm: 544,
        md: 769,
        lg: 992,
        xl: 1200,
        xxl: 1440,
    };
    function up(key) {
        var value = typeof key === 'number' ? key : values[key];
        return "@media (min-width:" + value + unit + ")";
    }
    function down(key) {
        var value = typeof key === 'number' ? key : values[key];
        return "@media (max-width:" + (value - step / 100) + unit + ")";
    }
    // TODO add functions for between and only
    return {
        values: values,
        up: up,
        down: down,
        keys: keys,
        unit: unit,
    };
}
//# sourceMappingURL=breakpoints.js.map