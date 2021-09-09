import { DataQuery } from '@grafana/data';
import { migrateMultipleStatsAnnotationQuery, migrateMultipleStatsMetricsQuery } from './migrations';
import { CloudWatchAnnotationQuery, CloudWatchMetricsQuery } from './types';

describe('migration', () => {
  describe('migrateMultipleStatsMetricsQuery', () => {
    const queryToMigrate = {
      statistics: ['Average', 'Sum', 'Maximum'],
      refId: 'A',
    };
    const panelQueries: DataQuery[] = [
      { ...queryToMigrate },
      {
        refId: 'B',
      },
    ];
    const newQueries = migrateMultipleStatsMetricsQuery(queryToMigrate as CloudWatchMetricsQuery, panelQueries);
    const newMetricQueries = newQueries as CloudWatchMetricsQuery[];

    it('should create one new query for each stat', () => {
      expect(newQueries.length).toBe(2);
    });

    it('should assign new queries the right stats', () => {
      expect(newMetricQueries[0].statistic).toBe('Sum');
      expect(newMetricQueries[1].statistic).toBe('Maximum');
    });

    it('should assign new queries the right ref id', () => {
      expect(newQueries[0].refId).toBe('C');
      expect(newQueries[1].refId).toBe('D');
    });

    it('should not have statistics prop anymore', () => {
      expect(queryToMigrate).not.toHaveProperty('statistics');
      expect(newQueries[0]).not.toHaveProperty('statistics');
      expect(newQueries[1]).not.toHaveProperty('statistics');
    });
  });

  describe('migrateMultipleStatsMetricsQuery with only one stat', () => {
    const queryToMigrate = {
      statistics: ['Average'],
      refId: 'A',
    } as CloudWatchMetricsQuery;
    const panelQueries: DataQuery[] = [
      { ...queryToMigrate },
      {
        refId: 'B',
      },
    ];
    const newQueries = migrateMultipleStatsMetricsQuery(queryToMigrate as CloudWatchMetricsQuery, panelQueries);

    it('should not create any new queries', () => {
      expect(newQueries.length).toBe(0);
    });

    it('should have the right stats', () => {
      expect(queryToMigrate.statistic).toBe('Average');
    });

    it('should not have statistics prop anymore', () => {
      expect(queryToMigrate).not.toHaveProperty('statistics');
    });
  });

  describe('migrateMultipleStatsAnnotationQuery', () => {
    const annotationToMigrate = {
      statistics: ['p23.23', 'SampleCount'],
      name: 'Test annotation',
    };

    const newAnnotations = migrateMultipleStatsAnnotationQuery(annotationToMigrate as CloudWatchAnnotationQuery);
    const newCloudWatchAnnotations = newAnnotations as CloudWatchAnnotationQuery[];

    it('should create one new annotation for each stat', () => {
      expect(newAnnotations.length).toBe(1);
    });

    it('should assign new queries the right stats', () => {
      expect(newCloudWatchAnnotations[0].statistic).toBe('SampleCount');
    });

    it('should assign new queries the right ref id', () => {
      expect(newAnnotations[0].name).toBe('Test annotation - SampleCount');
    });

    it('should not have statistics prop anymore', () => {
      expect(newCloudWatchAnnotations[0]).not.toHaveProperty('statistics');
    });

    it('should migrate original query correctly', () => {
      expect(annotationToMigrate).not.toHaveProperty('statistics');
      expect(annotationToMigrate.name).toBe('Test annotation - p23.23');
    });

    describe('migrateMultipleStatsAnnotationQuery with only with stat', () => {
      const annotationToMigrate = {
        statistics: ['p23.23'],
        name: 'Test annotation',
      } as CloudWatchAnnotationQuery;
      const newAnnotations = migrateMultipleStatsAnnotationQuery(annotationToMigrate as CloudWatchAnnotationQuery);

      it('should not create new annotations', () => {
        expect(newAnnotations.length).toBe(0);
      });

      it('should not change the name', () => {
        expect(annotationToMigrate.name).toBe('Test annotation');
      });

      it('should use statistics prop and remove statistics prop', () => {
        expect(annotationToMigrate.statistic).toEqual('p23.23');
        expect(annotationToMigrate).not.toHaveProperty('statistics');
      });
    });
  });
});
