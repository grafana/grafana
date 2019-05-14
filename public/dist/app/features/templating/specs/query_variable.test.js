import { QueryVariable } from '../query_variable';
describe('QueryVariable', function () {
    describe('when creating from model', function () {
        it('should set defaults', function () {
            var variable = new QueryVariable({}, null, null, null, null);
            expect(variable.datasource).toBe(null);
            expect(variable.refresh).toBe(0);
            expect(variable.sort).toBe(0);
            expect(variable.name).toBe('');
            expect(variable.hide).toBe(0);
            expect(variable.options.length).toBe(0);
            expect(variable.multi).toBe(false);
            expect(variable.includeAll).toBe(false);
        });
        it('get model should copy changes back to model', function () {
            var variable = new QueryVariable({}, null, null, null, null);
            variable.options = [{ text: 'test' }];
            variable.datasource = 'google';
            variable.regex = 'asd';
            variable.sort = 50;
            var model = variable.getSaveModel();
            expect(model.options.length).toBe(1);
            expect(model.options[0].text).toBe('test');
            expect(model.datasource).toBe('google');
            expect(model.regex).toBe('asd');
            expect(model.sort).toBe(50);
        });
        it('if refresh != 0 then remove options in presisted mode', function () {
            var variable = new QueryVariable({}, null, null, null, null);
            variable.options = [{ text: 'test' }];
            variable.refresh = 1;
            var model = variable.getSaveModel();
            expect(model.options.length).toBe(0);
        });
    });
    describe('can convert and sort metric names', function () {
        var variable = new QueryVariable({}, null, null, null, null);
        var input;
        beforeEach(function () {
            input = [
                { text: '0', value: '0' },
                { text: '1', value: '1' },
                { text: null, value: 3 },
                { text: undefined, value: 4 },
                { text: '5', value: null },
                { text: '6', value: undefined },
                { text: null, value: '7' },
                { text: undefined, value: '8' },
                { text: 9, value: null },
                { text: 10, value: undefined },
                { text: '', value: undefined },
                { text: undefined, value: '' },
            ];
        });
        describe('can sort a mixed array of metric variables in numeric order', function () {
            var result;
            beforeEach(function () {
                variable.sort = 3; // Numerical (asc)
                result = variable.metricNamesToVariableValues(input);
            });
            it('should return in same order', function () {
                var i = 0;
                expect(result.length).toBe(11);
                expect(result[i++].text).toBe('');
                expect(result[i++].text).toBe('0');
                expect(result[i++].text).toBe('1');
                expect(result[i++].text).toBe('3');
                expect(result[i++].text).toBe('4');
                expect(result[i++].text).toBe('5');
                expect(result[i++].text).toBe('6');
            });
        });
        describe('can sort a mixed array of metric variables in alphabetical order', function () {
            var result;
            beforeEach(function () {
                variable.sort = 5; // Alphabetical CI (asc)
                result = variable.metricNamesToVariableValues(input);
            });
            it('should return in same order', function () {
                var i = 0;
                expect(result.length).toBe(11);
                expect(result[i++].text).toBe('');
                expect(result[i++].text).toBe('0');
                expect(result[i++].text).toBe('1');
                expect(result[i++].text).toBe('10');
                expect(result[i++].text).toBe('3');
                expect(result[i++].text).toBe('4');
                expect(result[i++].text).toBe('5');
            });
        });
    });
});
//# sourceMappingURL=query_variable.test.js.map