// Deliberately duplicated from MixedDataSource.ts rather than imported from it: that module also
// pulls in the full MixedDatasource class (rxjs, getDataSourceSrv, getTemplateSrv, ...), which is too
// heavy for code that only needs this one name and would otherwise drag that class into every bundle
// that imports it — e.g. the notebook feature's own lazily-loaded chunk. Re-exporting it from
// MixedDataSource.ts instead is blocked by the no-barrel-files lint rule.
export const MIXED_DATASOURCE_NAME = '-- Mixed --';
