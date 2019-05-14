import * as ticks from '../utils/ticks';
describe('ticks', function () {
    describe('getFlotTickDecimals()', function () {
        var ctx = {};
        beforeEach(function () {
            ctx.axis = {};
        });
        it('should calculate decimals precision based on graph height', function () {
            var dec = ticks.getFlotTickDecimals(0, 10, ctx.axis, 200);
            expect(dec.tickDecimals).toBe(1);
            expect(dec.scaledDecimals).toBe(1);
            dec = ticks.getFlotTickDecimals(0, 100, ctx.axis, 200);
            expect(dec.tickDecimals).toBe(0);
            expect(dec.scaledDecimals).toBe(-1);
            dec = ticks.getFlotTickDecimals(0, 1, ctx.axis, 200);
            expect(dec.tickDecimals).toBe(2);
            expect(dec.scaledDecimals).toBe(3);
        });
    });
});
//# sourceMappingURL=ticks.test.js.map