import { VariableQueryType, OldVariableQuery } from '../types';

import { migrateVariableQuery } from './variableQueryMigrations';

describe('variableQueryMigrations', () => {
  describe('migrateVariableQuery', () => {
    describe('when metrics query is used', () => {
      describe('and region param is left out', () => {
        it('should leave an empty region', () => {
          const query = migrateVariableQuery('metrics(testNamespace)');
          expect(query.queryType).toBe(VariableQueryType.Metrics);
          expect(query.namespace).toBe('testNamespace');
          expect(query.region).toBe('');
        });
      });

      describe('and region param is defined by user', () => {
        it('should use the user defined region', () => {
          const query = migrateVariableQuery('metrics(testNamespace2, custom-region)');
          expect(query.queryType).toBe(VariableQueryType.Metrics);
          expect(query.namespace).toBe('testNamespace2');
          expect(query.region).toBe('custom-region');
        });
      });
    });
    describe('when dimension_values query is used', () => {
      describe('and filter param is left out', () => {
        it('should leave an empty filter', () => {
          const query = migrateVariableQuery('dimension_values(us-east-1,AWS/RDS,CPUUtilization,DBInstanceIdentifier)');
          expect(query.queryType).toBe(VariableQueryType.DimensionValues);
          expect(query.region).toBe('us-east-1');
          expect(query.namespace).toBe('AWS/RDS');
          expect(query.metricName).toBe('CPUUtilization');
          expect(query.dimensionKey).toBe('DBInstanceIdentifier');
          expect(query.dimensionFilters).toStrictEqual({});
        });
      });
      describe('and filter param is defined by user', () => {
        it('should use the user defined filter', () => {
          const query = migrateVariableQuery(
            'dimension_values(us-east-1,AWS/RDS,CPUUtilization,DBInstanceIdentifier,{"InstanceId":"$instance_id"})'
          );
          expect(query.queryType).toBe(VariableQueryType.DimensionValues);
          expect(query.region).toBe('us-east-1');
          expect(query.namespace).toBe('AWS/RDS');
          expect(query.metricName).toBe('CPUUtilization');
          expect(query.dimensionKey).toBe('DBInstanceIdentifier');
          expect(query.dimensionFilters).toStrictEqual({ InstanceId: '$instance_id' });
        });
      });
    });
  });
  describe('when resource_arns query is used', () => {
    it('should parse the query', () => {
      const query = migrateVariableQuery(
        'resource_arns(eu-west-1,elasticloadbalancing:loadbalancer,{"elasticbeanstalk:environment-name":["myApp-dev","myApp-prod"]})'
      );
      expect(query.queryType).toBe(VariableQueryType.ResourceArns);
      expect(query.region).toBe('eu-west-1');
      expect(query.resourceType).toBe('elasticloadbalancing:loadbalancer');
      expect(query.tags).toStrictEqual({ 'elasticbeanstalk:environment-name': ['myApp-dev', 'myApp-prod'] });
    });
  });
  describe('when ec2_instance_attribute query is used', () => {
    it('should parse the query', () => {
      const query = migrateVariableQuery('ec2_instance_attribute(us-east-1,rds:db,{"environment":["$environment"]})');
      expect(query.queryType).toBe(VariableQueryType.EC2InstanceAttributes);
      expect(query.region).toBe('us-east-1');
      expect(query.attributeName).toBe('rds:db');
      expect(query.ec2Filters).toStrictEqual({ environment: ['$environment'] });
    });
  });
  describe('when OldVariableQuery is used', () => {
    it('should parse the query', () => {
      const oldQuery: OldVariableQuery = {
        queryType: VariableQueryType.EC2InstanceAttributes,
        namespace: '',
        region: 'us-east-1',
        metricName: '',
        dimensionKey: '',
        ec2Filters: '{"environment":["$environment"]}',
        instanceID: '',
        attributeName: 'rds:db',
        resourceType: 'elasticloadbalancing:loadbalancer',
        tags: '{"elasticbeanstalk:environment-name":["myApp-dev","myApp-prod"]}',
        refId: '',
      };
      const query = migrateVariableQuery(oldQuery);
      expect(query.region).toBe('us-east-1');
      expect(query.attributeName).toBe('rds:db');
      expect(query.ec2Filters).toStrictEqual({ environment: ['$environment'] });
      expect(query.resourceType).toBe('elasticloadbalancing:loadbalancer');
      expect(query.tags).toStrictEqual({ 'elasticbeanstalk:environment-name': ['myApp-dev', 'myApp-prod'] });
    });
  });
});
