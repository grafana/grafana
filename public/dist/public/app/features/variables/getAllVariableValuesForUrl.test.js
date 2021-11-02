import { setTemplateSrv } from '@grafana/runtime';
import { variableAdapters } from './adapters';
import { createQueryVariableAdapter } from './query/adapter';
import { getVariablesUrlParams } from './getAllVariableValuesForUrl';
import { initTemplateSrv } from '../../../test/helpers/initTemplateSrv';
describe('getAllVariableValuesForUrl', function () {
    beforeAll(function () {
        variableAdapters.register(createQueryVariableAdapter());
    });
    describe('with multi value', function () {
        beforeEach(function () {
            setTemplateSrv(initTemplateSrv([
                {
                    type: 'query',
                    name: 'test',
                    current: { value: ['val1', 'val2'] },
                    getValueForUrl: function () {
                        return this.current.value;
                    },
                },
            ]));
        });
        it('should set multiple url params', function () {
            var params = getVariablesUrlParams();
            expect(params['var-test']).toMatchObject(['val1', 'val2']);
        });
    });
    describe('skip url sync', function () {
        beforeEach(function () {
            setTemplateSrv(initTemplateSrv([
                {
                    name: 'test',
                    skipUrlSync: true,
                    current: { value: 'value' },
                    getValueForUrl: function () {
                        return this.current.value;
                    },
                },
            ]));
        });
        it('should not include template variable value in url', function () {
            var params = getVariablesUrlParams();
            expect(params['var-test']).toBe(undefined);
        });
    });
    describe('with multi value with skip url sync', function () {
        beforeEach(function () {
            setTemplateSrv(initTemplateSrv([
                {
                    type: 'query',
                    name: 'test',
                    skipUrlSync: true,
                    current: { value: ['val1', 'val2'] },
                    getValueForUrl: function () {
                        return this.current.value;
                    },
                },
            ]));
        });
        it('should not include template variable value in url', function () {
            var params = getVariablesUrlParams();
            expect(params['var-test']).toBe(undefined);
        });
    });
    describe('fillVariableValuesForUrl with multi value and scopedVars', function () {
        beforeEach(function () {
            setTemplateSrv(initTemplateSrv([{ type: 'query', name: 'test', current: { value: ['val1', 'val2'] } }]));
        });
        it('should set scoped value as url params', function () {
            var params = getVariablesUrlParams({
                test: { value: 'val1', text: 'val1text' },
            });
            expect(params['var-test']).toBe('val1');
        });
    });
    describe('fillVariableValuesForUrl with multi value, scopedVars and skip url sync', function () {
        beforeEach(function () {
            setTemplateSrv(initTemplateSrv([{ type: 'query', name: 'test', current: { value: ['val1', 'val2'] } }]));
        });
        it('should not set scoped value as url params', function () {
            var params = getVariablesUrlParams({
                test: { name: 'test', value: 'val1', text: 'val1text', skipUrlSync: true },
            });
            expect(params['var-test']).toBe(undefined);
        });
    });
});
//# sourceMappingURL=getAllVariableValuesForUrl.test.js.map