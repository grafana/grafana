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
      describe('and filter value is an empty array', () => {
        it('should leave an empty filter', () => {
          const query = migrateVariableQuery(
            'dimension_values(us-east-1,AWS/RDS,CPUUtilization,DBInstanceIdentifier, [])'
          );
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
        it('should migrate json template variables', () => {
          const query = migrateVariableQuery(
            'dimension_values(us-east-1,AWS/RDS,CPUUtilization,DBInstanceIdentifier,{"role":${role:json},"pop":${pop:json}})'
          );
          expect(query.dimensionFilters).toStrictEqual({ role: '$role', pop: '$pop' });
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
    it('should migrate json template variables', () => {
      const query = migrateVariableQuery(
        'resource_arns(eu-west-1,elasticloadbalancing:loadbalancer,{"elasticbeanstalk:environment-name":[${jsonVar:json},"test-$singleVar"]})'
      );
      expect(query.tags).toStrictEqual({ 'elasticbeanstalk:environment-name': ['$jsonVar', 'test-$singleVar'] });
    });
    it('should parse a empty array for tags', () => {
      const query = migrateVariableQuery('resource_arns(eu-west-1,elasticloadbalancing:loadbalancer, [])');
      expect(query.tags).toStrictEqual({});
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
    it('should migrate json template variables', () => {
      const query = migrateVariableQuery('ec2_instance_attribute(us-east-1,rds:db,{"environment":${env:json}})');
      expect(query.ec2Filters).toStrictEqual({ environment: ['$env'] });
    });
    it('should parse an empty array for filters', () => {
      const query = migrateVariableQuery('ec2_instance_attribute(us-east-1,rds:db,[])');
      expect(query.ec2Filters).toStrictEqual({});
    });
  });
  describe('when OldVariableQuery is used', () => {
    const baseOldQuery: OldVariableQuery = {
      queryType: VariableQueryType.Regions,
      namespace: '',
      region: 'us-east-1',
      metricName: '',
      dimensionKey: '',
      dimensionFilters: '',
      ec2Filters: '',
      instanceID: '',
      attributeName: '',
      resourceType: '',
      tags: '',
      refId: '',
    };
    it('should parse ec2 query', () => {
      const oldQuery: OldVariableQuery = {
        ...baseOldQuery,
        queryType: VariableQueryType.EC2InstanceAttributes,
        ec2Filters: '{"environment":["$environment"]}',
        attributeName: 'rds:db',
      };
      const query = migrateVariableQuery(oldQuery);
      expect(query.region).toBe('us-east-1');
      expect(query.attributeName).toBe('rds:db');
      expect(query.ec2Filters).toStrictEqual({ environment: ['$environment'] });
    });
    it('should parse resource arn query', () => {
      const oldQuery: OldVariableQuery = {
        ...baseOldQuery,
        queryType: VariableQueryType.ResourceArns,
        resourceType: 'elasticloadbalancing:loadbalancer',
        tags: '{"elasticbeanstalk:environment-name":["myApp-dev","myApp-prod"]}',
      };
      const query = migrateVariableQuery(oldQuery);
      expect(query.region).toBe('us-east-1');
      expect(query.resourceType).toBe('elasticloadbalancing:loadbalancer');
      expect(query.tags).toStrictEqual({ 'elasticbeanstalk:environment-name': ['myApp-dev', 'myApp-prod'] });
    });
    it('should parse dimension values query', () => {
      const oldQuery: OldVariableQuery = {
        ...baseOldQuery,
        queryType: VariableQueryType.DimensionValues,
        metricName: 'foo',
        dimensionKey: 'bar',
        dimensionFilters: '{"InstanceId":"$instanceid"}',
      };
      const query = migrateVariableQuery(oldQuery);
      expect(query.metricName).toBe('foo');
      expect(query.dimensionKey).toBe('bar');
      expect(query.dimensionFilters).toStrictEqual({ InstanceId: '$instanceid' });
    });
  });
});
