import TimeGrainConverter from './time_grain_converter';

describe('TimeGrainConverter', () => {
  describe('with duration of PT1H', () => {
    it('should convert it to text', () => {
      expect(TimeGrainConverter.createTimeGrainFromISO8601Duration('PT1H')).toEqual('1 hour');
    });

    it('should convert it to kbn', () => {
      expect(TimeGrainConverter.createKbnUnitFromISO8601Duration('PT1H')).toEqual('1h');
    });
  });

  describe('with duration of P1D', () => {
    it('should convert it to text', () => {
      expect(TimeGrainConverter.createTimeGrainFromISO8601Duration('P1D')).toEqual('1 day');
    });

    it('should convert it to kbn', () => {
      expect(TimeGrainConverter.createKbnUnitFromISO8601Duration('P1D')).toEqual('1d');
    });
  });
});
