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
          variables: { standard: { toDataQuery: () => undefined } },
        };
        expect(hasStandardVariableSupport(datasource)).toBe(true);
      });

      describe('and with a custom query', () => {
        it('should return true', () => {
          const datasource: any = {
            metricFindQuery: () => undefined,
            variables: { standard: { toDataQuery: () => undefined, query: () => undefined } },
          };
          expect(hasStandardVariableSupport(datasource)).toBe(true);
        });
      });
    });

    describe('when called with a data source with partial standard variable support', () => {
      it('should return false', () => {
        const datasource: any = {
          metricFindQuery: () => undefined,
          variables: { standard: { query: () => undefined } },
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

    describe('when called with a data source with standard variable support and datasource variable support', () => {
      it('should return false', () => {
        const datasource: any = {
          variables: { standard: { toDataQuery: () => undefined }, datasource: {} },
        };
        expect(hasStandardVariableSupport(datasource)).toBe(false);
      });
    });

    describe('when called with a data source source with standard variable support and custom variable support', () => {
      it('should return false', () => {
        const datasource: any = {
          variables: { standard: { toDataQuery: () => undefined }, custom: {} },
        };
        expect(hasStandardVariableSupport(datasource)).toBe(false);
      });
    });

    describe('when called with a data source source with standard variable support, datasource variable support and custom variable support', () => {
      it('should return false', () => {
        const datasource: any = {
          variables: { standard: { toDataQuery: () => undefined }, datasource: {}, custom: {} },
        };
        expect(hasStandardVariableSupport(datasource)).toBe(false);
      });
    });
  });

  describe('hasCustomVariableSupport', () => {
    describe('when called with a data source with custom variable support', () => {
      it('should return true', () => {
        const datasource: any = {
          metricFindQuery: () => undefined,
          variables: { custom: { query: () => undefined, editor: {} } },
        };
        expect(hasCustomVariableSupport(datasource)).toBe(true);
      });
    });

    describe('when called with a data source with custom variable support but without editor', () => {
      it('should return false', () => {
        const datasource: any = {
          metricFindQuery: () => undefined,
          variables: { custom: { query: () => undefined } },
        };
        expect(hasCustomVariableSupport(datasource)).toBe(false);
      });
    });

    describe('when called with a data source with custom variable support but without query', () => {
      it('should return false', () => {
        const datasource: any = {
          metricFindQuery: () => undefined,
          variables: { custom: { editor: {} } },
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

    describe('when called with a data source with custom variable support and datasource variable support', () => {
      it('should return false', () => {
        const datasource: any = {
          variables: { custom: { query: () => undefined, editor: {} }, datasource: {} },
        };
        expect(hasCustomVariableSupport(datasource)).toBe(false);
      });
    });

    describe('when called with a data source source with custom variable support and standard variable support', () => {
      it('should return false', () => {
        const datasource: any = {
          variables: { custom: { query: () => undefined, editor: {} }, standard: {} },
        };
        expect(hasCustomVariableSupport(datasource)).toBe(false);
      });
    });

    describe('when called with a data source source with custom variable support, datasource variable support and standard variable support', () => {
      it('should return false', () => {
        const datasource: any = {
          variables: { custom: { query: () => undefined, editor: {} }, datasource: {}, standard: {} },
        };
        expect(hasCustomVariableSupport(datasource)).toBe(false);
      });
    });
  });

  describe('hasDatasourceVariableSupport', () => {
    describe('when called with a data source with datasource variable support', () => {
      it('should return true', () => {
        const datasource: any = {
          metricFindQuery: () => undefined,
          variables: { datasource: { editor: {} } },
        };
        expect(hasDatasourceVariableSupport(datasource)).toBe(true);
      });
    });

    describe('when called with a data source with datasource variable support but without editor', () => {
      it('should return false', () => {
        const datasource: any = {
          metricFindQuery: () => undefined,
          variables: { datasource: {} },
        };
        expect(hasDatasourceVariableSupport(datasource)).toBe(false);
      });
    });

    describe('when called with a data source without datasource variable support', () => {
      it('should return false', () => {
        const datasource: any = { metricFindQuery: () => undefined };
        expect(hasDatasourceVariableSupport(datasource)).toBe(false);
      });
    });

    describe('when called with a data source with datasource variable support and custom variable support', () => {
      it('should return false', () => {
        const datasource: any = {
          variables: { datasource: { editor: {} }, custom: { query: () => undefined, editor: {} } },
        };
        expect(hasDatasourceVariableSupport(datasource)).toBe(false);
      });
    });

    describe('when called with a data source source with datasource variable support and standard variable support', () => {
      it('should return false', () => {
        const datasource: any = {
          variables: { datasource: { editor: {} }, standard: {} },
        };
        expect(hasDatasourceVariableSupport(datasource)).toBe(false);
      });
    });

    describe('when called with a data source source with datasource variable support, custom variable support and standard variable support', () => {
      it('should return false', () => {
        const datasource: any = {
          variables: { datasource: { editor: {} }, custom: { query: () => undefined, editor: {} }, standard: {} },
        };
        expect(hasDatasourceVariableSupport(datasource)).toBe(false);
      });
    });
  });
});
