import { hasCustomVariableSupport, hasDatasourceVariableSupport, hasLegacyVariableSupport, hasStandardVariableSupport, isLegacyQueryEditor, isQueryEditor, } from './guard';
import { LegacyVariableQueryEditor } from './editor/LegacyVariableQueryEditor';
import { StandardVariableQueryEditor } from './editor/getVariableQueryEditor';
import { VariableSupportType } from '@grafana/data';
describe('type guards', function () {
    describe('hasLegacyVariableSupport', function () {
        describe('when called with a legacy data source', function () {
            it('should return true', function () {
                var datasource = { metricFindQuery: function () { return undefined; } };
                expect(hasLegacyVariableSupport(datasource)).toBe(true);
            });
        });
        describe('when called with data source without metricFindQuery function', function () {
            it('should return false', function () {
                var datasource = {};
                expect(hasLegacyVariableSupport(datasource)).toBe(false);
            });
        });
        describe('when called with a legacy data source with variable support', function () {
            it('should return false', function () {
                var datasource = { metricFindQuery: function () { return undefined; }, variables: {} };
                expect(hasLegacyVariableSupport(datasource)).toBe(false);
            });
        });
    });
    describe('hasStandardVariableSupport', function () {
        describe('when called with a data source with standard variable support', function () {
            it('should return true', function () {
                var datasource = {
                    metricFindQuery: function () { return undefined; },
                    variables: { getType: function () { return VariableSupportType.Standard; }, toDataQuery: function () { return undefined; } },
                };
                expect(hasStandardVariableSupport(datasource)).toBe(true);
            });
            describe('and with a custom query', function () {
                it('should return true', function () {
                    var datasource = {
                        metricFindQuery: function () { return undefined; },
                        variables: {
                            getType: function () { return VariableSupportType.Standard; },
                            toDataQuery: function () { return undefined; },
                            query: function () { return undefined; },
                        },
                    };
                    expect(hasStandardVariableSupport(datasource)).toBe(true);
                });
            });
        });
        describe('when called with a data source with partial standard variable support', function () {
            it('should return false', function () {
                var datasource = {
                    metricFindQuery: function () { return undefined; },
                    variables: { getType: function () { return VariableSupportType.Standard; }, query: function () { return undefined; } },
                };
                expect(hasStandardVariableSupport(datasource)).toBe(false);
            });
        });
        describe('when called with a data source without standard variable support', function () {
            it('should return false', function () {
                var datasource = { metricFindQuery: function () { return undefined; } };
                expect(hasStandardVariableSupport(datasource)).toBe(false);
            });
        });
    });
    describe('hasCustomVariableSupport', function () {
        describe('when called with a data source with custom variable support', function () {
            it('should return true', function () {
                var datasource = {
                    metricFindQuery: function () { return undefined; },
                    variables: { getType: function () { return VariableSupportType.Custom; }, query: function () { return undefined; }, editor: {} },
                };
                expect(hasCustomVariableSupport(datasource)).toBe(true);
            });
        });
        describe('when called with a data source with custom variable support but without editor', function () {
            it('should return false', function () {
                var datasource = {
                    metricFindQuery: function () { return undefined; },
                    variables: { getType: function () { return VariableSupportType.Custom; }, query: function () { return undefined; } },
                };
                expect(hasCustomVariableSupport(datasource)).toBe(false);
            });
        });
        describe('when called with a data source with custom variable support but without query', function () {
            it('should return false', function () {
                var datasource = {
                    metricFindQuery: function () { return undefined; },
                    variables: { getType: function () { return VariableSupportType.Custom; }, editor: {} },
                };
                expect(hasCustomVariableSupport(datasource)).toBe(false);
            });
        });
        describe('when called with a data source without custom variable support', function () {
            it('should return false', function () {
                var datasource = { metricFindQuery: function () { return undefined; } };
                expect(hasCustomVariableSupport(datasource)).toBe(false);
            });
        });
    });
    describe('hasDatasourceVariableSupport', function () {
        describe('when called with a data source with datasource variable support', function () {
            it('should return true', function () {
                var datasource = {
                    metricFindQuery: function () { return undefined; },
                    variables: { getType: function () { return VariableSupportType.Datasource; } },
                };
                expect(hasDatasourceVariableSupport(datasource)).toBe(true);
            });
        });
        describe('when called with a data source without datasource variable support', function () {
            it('should return false', function () {
                var datasource = { metricFindQuery: function () { return undefined; } };
                expect(hasDatasourceVariableSupport(datasource)).toBe(false);
            });
        });
    });
});
describe('isLegacyQueryEditor', function () {
    describe('happy cases', function () {
        describe('when called with a legacy query editor but without a legacy data source', function () {
            it('then is should return true', function () {
                var component = LegacyVariableQueryEditor;
                var datasource = {};
                expect(isLegacyQueryEditor(component, datasource)).toBe(true);
            });
        });
        describe('when called with a legacy data source but without a legacy query editor', function () {
            it('then is should return true', function () {
                var component = StandardVariableQueryEditor;
                var datasource = { metricFindQuery: function () { return undefined; } };
                expect(isLegacyQueryEditor(component, datasource)).toBe(true);
            });
        });
    });
    describe('negative cases', function () {
        describe('when called without component', function () {
            it('then is should return false', function () {
                var component = null;
                var datasource = { metricFindQuery: function () { return undefined; } };
                expect(isLegacyQueryEditor(component, datasource)).toBe(false);
            });
        });
        describe('when called without a legacy query editor and without a legacy data source', function () {
            it('then is should return false', function () {
                var component = StandardVariableQueryEditor;
                var datasource = {};
                expect(isLegacyQueryEditor(component, datasource)).toBe(false);
            });
        });
    });
});
describe('isQueryEditor', function () {
    describe('happy cases', function () {
        describe('when called without a legacy editor and with a data source with standard variable support', function () {
            it('then is should return true', function () {
                var component = StandardVariableQueryEditor;
                var datasource = {
                    variables: { getType: function () { return VariableSupportType.Standard; }, toDataQuery: function () { return undefined; } },
                };
                expect(isQueryEditor(component, datasource)).toBe(true);
            });
        });
        describe('when called without a legacy editor and with a data source with custom variable support', function () {
            it('then is should return true', function () {
                var component = StandardVariableQueryEditor;
                var datasource = {
                    variables: { getType: function () { return VariableSupportType.Custom; }, query: function () { return undefined; }, editor: {} },
                };
                expect(isQueryEditor(component, datasource)).toBe(true);
            });
        });
        describe('when called without a legacy editor and with a data source with datasource variable support', function () {
            it('then is should return true', function () {
                var component = StandardVariableQueryEditor;
                var datasource = { variables: { getType: function () { return VariableSupportType.Datasource; } } };
                expect(isQueryEditor(component, datasource)).toBe(true);
            });
        });
    });
    describe('negative cases', function () {
        describe('when called without component', function () {
            it('then is should return false', function () {
                var component = null;
                var datasource = { metricFindQuery: function () { return undefined; } };
                expect(isQueryEditor(component, datasource)).toBe(false);
            });
        });
        describe('when called with a legacy query editor', function () {
            it('then is should return false', function () {
                var component = LegacyVariableQueryEditor;
                var datasource = { variables: { getType: function () { return VariableSupportType.Datasource; } } };
                expect(isQueryEditor(component, datasource)).toBe(false);
            });
        });
        describe('when called without a legacy query editor but with a legacy data source', function () {
            it('then is should return false', function () {
                var component = StandardVariableQueryEditor;
                var datasource = { metricFindQuery: function () { return undefined; } };
                expect(isQueryEditor(component, datasource)).toBe(false);
            });
        });
    });
});
//# sourceMappingURL=guard.test.js.map