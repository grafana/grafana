import TimeGrainConverter from './time_grain_converter';
describe('TimeGrainConverter', function () {
    describe('with duration of PT1H', function () {
        it('should convert it to text', function () {
            expect(TimeGrainConverter.createTimeGrainFromISO8601Duration('PT1H')).toEqual('1 hour');
        });
        it('should convert it to kbn', function () {
            expect(TimeGrainConverter.createKbnUnitFromISO8601Duration('PT1H')).toEqual('1h');
        });
    });
    describe('with duration of P1D', function () {
        it('should convert it to text', function () {
            expect(TimeGrainConverter.createTimeGrainFromISO8601Duration('P1D')).toEqual('1 day');
        });
        it('should convert it to kbn', function () {
            expect(TimeGrainConverter.createKbnUnitFromISO8601Duration('P1D')).toEqual('1d');
        });
    });
});
//# sourceMappingURL=time_grain_converter.test.js.map