import { __assign } from "tslib";
import { migrateMultipleStatsAnnotationQuery, migrateMultipleStatsMetricsQuery } from './migrations';
describe('migration', function () {
    describe('migrateMultipleStatsMetricsQuery', function () {
        var queryToMigrate = {
            statistics: ['Average', 'Sum', 'Maximum'],
            refId: 'A',
        };
        var panelQueries = [
            __assign({}, queryToMigrate),
            {
                refId: 'B',
            },
        ];
        var newQueries = migrateMultipleStatsMetricsQuery(queryToMigrate, panelQueries);
        var newMetricQueries = newQueries;
        it('should create one new query for each stat', function () {
            expect(newQueries.length).toBe(2);
        });
        it('should assign new queries the right stats', function () {
            expect(newMetricQueries[0].statistic).toBe('Sum');
            expect(newMetricQueries[1].statistic).toBe('Maximum');
        });
        it('should assign new queries the right ref id', function () {
            expect(newQueries[0].refId).toBe('C');
            expect(newQueries[1].refId).toBe('D');
        });
        it('should not have statistics prop anymore', function () {
            expect(queryToMigrate).not.toHaveProperty('statistics');
            expect(newQueries[0]).not.toHaveProperty('statistics');
            expect(newQueries[1]).not.toHaveProperty('statistics');
        });
    });
    describe('migrateMultipleStatsMetricsQuery with only one stat', function () {
        var queryToMigrate = {
            statistics: ['Average'],
            refId: 'A',
        };
        var panelQueries = [
            __assign({}, queryToMigrate),
            {
                refId: 'B',
            },
        ];
        var newQueries = migrateMultipleStatsMetricsQuery(queryToMigrate, panelQueries);
        it('should not create any new queries', function () {
            expect(newQueries.length).toBe(0);
        });
        it('should have the right stats', function () {
            expect(queryToMigrate.statistic).toBe('Average');
        });
        it('should not have statistics prop anymore', function () {
            expect(queryToMigrate).not.toHaveProperty('statistics');
        });
    });
    describe('migrateMultipleStatsAnnotationQuery', function () {
        var annotationToMigrate = {
            statistics: ['p23.23', 'SampleCount'],
            name: 'Test annotation',
        };
        var newAnnotations = migrateMultipleStatsAnnotationQuery(annotationToMigrate);
        var newCloudWatchAnnotations = newAnnotations;
        it('should create one new annotation for each stat', function () {
            expect(newAnnotations.length).toBe(1);
        });
        it('should assign new queries the right stats', function () {
            expect(newCloudWatchAnnotations[0].statistic).toBe('SampleCount');
        });
        it('should assign new queries the right ref id', function () {
            expect(newAnnotations[0].name).toBe('Test annotation - SampleCount');
        });
        it('should not have statistics prop anymore', function () {
            expect(newCloudWatchAnnotations[0]).not.toHaveProperty('statistics');
        });
        it('should migrate original query correctly', function () {
            expect(annotationToMigrate).not.toHaveProperty('statistics');
            expect(annotationToMigrate.name).toBe('Test annotation - p23.23');
        });
        describe('migrateMultipleStatsAnnotationQuery with only with stat', function () {
            var annotationToMigrate = {
                statistics: ['p23.23'],
                name: 'Test annotation',
            };
            var newAnnotations = migrateMultipleStatsAnnotationQuery(annotationToMigrate);
            it('should not create new annotations', function () {
                expect(newAnnotations.length).toBe(0);
            });
            it('should not change the name', function () {
                expect(annotationToMigrate.name).toBe('Test annotation');
            });
            it('should use statistics prop and remove statistics prop', function () {
                expect(annotationToMigrate.statistic).toEqual('p23.23');
                expect(annotationToMigrate).not.toHaveProperty('statistics');
            });
        });
    });
});
//# sourceMappingURL=migration.test.js.map