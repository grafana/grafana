import {
  hasCustomVariableSupport,
  hasDatasourceVariableSupport,
  hasLegacyVariableSupport,
  hasStandardVariableSupport,
} from './guard';

describe('type guards', () => {
  describe('hasLegacyVariableSupport', () => {
    describe('when called with a legacy data source', () => {
      it('should return true', () => {
        const datasource: any = { metricFindQuery: () => undefined };
        expect(hasLegacyVariableSupport(datasource)).toBe(true);
      });
    });

    describe('when called with data source without metricFindQuery function', () => {
      it('should return false', () => {
        const datasource: any = {};
        expect(hasLegacyVariableSupport(datasource)).toBe(false);
      });
    });

    describe('when called with a legacy data source with variable support', () => {
      it('should return false', () => {
        const datasource: any = { metricFindQuery: () => undefined, variables: {} };
        expect(hasLegacyVariableSupport(datasource)).toBe(false);
      });
    });
  });

  describe('hasStandardVariableSupport', () => {
    describe('when called with a data source with standard variable support', () => {
      it('should return true', () => {
        const datasource: any = {
          metricFindQuery: () => undefined,
          variables: { type: 'standard', toDataQuery: () => undefined },
        };
        expect(hasStandardVariableSupport(datasource)).toBe(true);
      });

      describe('and with a custom query', () => {
        it('should return true', () => {
          const datasource: any = {
            metricFindQuery: () => undefined,
            variables: { type: 'standard', toDataQuery: () => undefined, query: () => undefined },
          };
          expect(hasStandardVariableSupport(datasource)).toBe(true);
        });
      });
    });

    describe('when called with a data source with partial standard variable support', () => {
      it('should return false', () => {
        const datasource: any = {
          metricFindQuery: () => undefined,
          variables: { type: 'standard', query: () => undefined },
        };
        expect(hasStandardVariableSupport(datasource)).toBe(false);
      });
    });

    describe('when called with a data source without standard variable support', () => {
      it('should return false', () => {
        const datasource: any = { metricFindQuery: () => undefined };
        expect(hasStandardVariableSupport(datasource)).toBe(false);
      });
    });
  });

  describe('hasCustomVariableSupport', () => {
    describe('when called with a data source with custom variable support', () => {
      it('should return true', () => {
        const datasource: any = {
          metricFindQuery: () => undefined,
          variables: { type: 'custom', query: () => undefined, editor: {} },
        };
        expect(hasCustomVariableSupport(datasource)).toBe(true);
      });
    });

    describe('when called with a data source with custom variable support but without editor', () => {
      it('should return false', () => {
        const datasource: any = {
          metricFindQuery: () => undefined,
          variables: { type: 'custom', query: () => undefined },
        };
        expect(hasCustomVariableSupport(datasource)).toBe(false);
      });
    });

    describe('when called with a data source with custom variable support but without query', () => {
      it('should return false', () => {
        const datasource: any = {
          metricFindQuery: () => undefined,
          variables: { type: 'custom', editor: {} },
        };
        expect(hasCustomVariableSupport(datasource)).toBe(false);
      });
    });

    describe('when called with a data source without custom variable support', () => {
      it('should return false', () => {
        const datasource: any = { metricFindQuery: () => undefined };
        expect(hasCustomVariableSupport(datasource)).toBe(false);
      });
    });
  });

  describe('hasDatasourceVariableSupport', () => {
    describe('when called with a data source with datasource variable support', () => {
      it('should return true', () => {
        const datasource: any = {
          metricFindQuery: () => undefined,
          variables: { type: 'datasource' },
        };
        expect(hasDatasourceVariableSupport(datasource)).toBe(true);
      });
    });

    describe('when called with a data source without datasource variable support', () => {
      it('should return false', () => {
        const datasource: any = { metricFindQuery: () => undefined };
        expect(hasDatasourceVariableSupport(datasource)).toBe(false);
      });
    });
  });
});
