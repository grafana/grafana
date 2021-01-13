import { setTemplateSrv } from '@grafana/runtime';
import { variableAdapters } from './adapters';
import { createQueryVariableAdapter } from './query/adapter';
import { getAllVariableValuesForUrl } from './getAllVariableValuesForUrl';
import { initTemplateSrv } from '../../../test/helpers/initTemplateSrv';

describe('getAllVariableValuesForUrl', () => {
  beforeAll(() => {
    variableAdapters.register(createQueryVariableAdapter());
  });

  describe('with multi value', () => {
    beforeEach(() => {
      setTemplateSrv(
        initTemplateSrv([
          {
            type: 'query',
            name: 'test',
            current: { value: ['val1', 'val2'] },
            getValueForUrl: function() {
              return this.current.value;
            },
          },
        ])
      );
    });

    it('should set multiple url params', () => {
      let params: any = getAllVariableValuesForUrl();
      expect(params['var-test']).toMatchObject(['val1', 'val2']);
    });
  });

  describe('skip url sync', () => {
    beforeEach(() => {
      setTemplateSrv(
        initTemplateSrv([
          {
            name: 'test',
            skipUrlSync: true,
            current: { value: 'value' },
            getValueForUrl: function() {
              return this.current.value;
            },
          },
        ])
      );
    });

    it('should not include template variable value in url', () => {
      const params = getAllVariableValuesForUrl();
      expect(params['var-test']).toBe(undefined);
    });
  });

  describe('with multi value with skip url sync', () => {
    beforeEach(() => {
      setTemplateSrv(
        initTemplateSrv([
          {
            type: 'query',
            name: 'test',
            skipUrlSync: true,
            current: { value: ['val1', 'val2'] },
            getValueForUrl: function() {
              return this.current.value;
            },
          },
        ])
      );
    });

    it('should not include template variable value in url', () => {
      const params = getAllVariableValuesForUrl();
      expect(params['var-test']).toBe(undefined);
    });
  });

  describe('fillVariableValuesForUrl with multi value and scopedVars', () => {
    beforeEach(() => {
      setTemplateSrv(initTemplateSrv([{ type: 'query', name: 'test', current: { value: ['val1', 'val2'] } }]));
    });

    it('should set scoped value as url params', () => {
      const params = getAllVariableValuesForUrl({
        test: { value: 'val1', text: 'val1text' },
      });
      expect(params['var-test']).toBe('val1');
    });
  });

  describe('fillVariableValuesForUrl with multi value, scopedVars and skip url sync', () => {
    beforeEach(() => {
      setTemplateSrv(initTemplateSrv([{ type: 'query', name: 'test', current: { value: ['val1', 'val2'] } }]));
    });

    it('should not set scoped value as url params', () => {
      const params = getAllVariableValuesForUrl({
        test: { name: 'test', value: 'val1', text: 'val1text', skipUrlSync: true },
      });
      expect(params['var-test']).toBe(undefined);
    });
  });
});
