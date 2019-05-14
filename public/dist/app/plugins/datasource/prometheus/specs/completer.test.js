import { PromCompleter } from '../completer';
import { PrometheusDatasource } from '../datasource';
jest.mock('../datasource');
jest.mock('app/core/services/backend_srv');
describe('Prometheus editor completer', function () {
    function getSessionStub(data) {
        return {
            getTokenAt: jest.fn(function () { return data.currentToken; }),
            getTokens: jest.fn(function () { return data.tokens; }),
            getLine: jest.fn(function () { return data.line; }),
        };
    }
    var editor = {};
    var backendSrv = {};
    var datasourceStub = new PrometheusDatasource({}, {}, backendSrv, {}, {});
    datasourceStub.metadataRequest = jest.fn(function () {
        return Promise.resolve({ data: { data: [{ metric: { job: 'node', instance: 'localhost:9100' } }] } });
    });
    datasourceStub.getTimeRange = jest.fn(function () {
        return { start: 1514732400, end: 1514818800 };
    });
    datasourceStub.performSuggestQuery = jest.fn(function () { return Promise.resolve(['node_cpu']); });
    var templateSrv = {
        variables: [
            {
                name: 'var_name',
                options: [{ text: 'foo', value: 'foo', selected: false }, { text: 'bar', value: 'bar', selected: true }],
            },
        ],
    };
    var completer = new PromCompleter(datasourceStub, templateSrv);
    describe('When inside brackets', function () {
        it('Should return range vectors', function () {
            var session = getSessionStub({
                currentToken: { type: 'paren.lparen', value: '[', index: 2, start: 9 },
                tokens: [{ type: 'identifier', value: 'node_cpu' }, { type: 'paren.lparen', value: '[' }],
                line: 'node_cpu[',
            });
            return completer.getCompletions(editor, session, { row: 0, column: 10 }, '[', function (s, res) {
                expect(res[0].caption).toEqual('$__interval');
                expect(res[0].value).toEqual('[$__interval');
                expect(res[0].meta).toEqual('range vector');
            });
        });
    });
    describe('When inside label matcher, and located at label name', function () {
        it('Should return label name list', function () {
            var session = getSessionStub({
                currentToken: {
                    type: 'entity.name.tag.label-matcher',
                    value: 'j',
                    index: 2,
                    start: 9,
                },
                tokens: [
                    { type: 'identifier', value: 'node_cpu' },
                    { type: 'paren.lparen.label-matcher', value: '{' },
                    {
                        type: 'entity.name.tag.label-matcher',
                        value: 'j',
                        index: 2,
                        start: 9,
                    },
                    { type: 'paren.rparen.label-matcher', value: '}' },
                ],
                line: 'node_cpu{j}',
            });
            return completer.getCompletions(editor, session, { row: 0, column: 10 }, 'j', function (s, res) {
                expect(res[0].meta).toEqual('label name');
            });
        });
    });
    describe('When inside label matcher, and located at label name with __name__ match', function () {
        it('Should return label name list', function () {
            var session = getSessionStub({
                currentToken: {
                    type: 'entity.name.tag.label-matcher',
                    value: 'j',
                    index: 5,
                    start: 22,
                },
                tokens: [
                    { type: 'paren.lparen.label-matcher', value: '{' },
                    { type: 'entity.name.tag.label-matcher', value: '__name__' },
                    { type: 'keyword.operator.label-matcher', value: '=~' },
                    { type: 'string.quoted.label-matcher', value: '"node_cpu"' },
                    { type: 'punctuation.operator.label-matcher', value: ',' },
                    {
                        type: 'entity.name.tag.label-matcher',
                        value: 'j',
                        index: 5,
                        start: 22,
                    },
                    { type: 'paren.rparen.label-matcher', value: '}' },
                ],
                line: '{__name__=~"node_cpu",j}',
            });
            return completer.getCompletions(editor, session, { row: 0, column: 23 }, 'j', function (s, res) {
                expect(res[0].meta).toEqual('label name');
            });
        });
    });
    describe('When inside label matcher, and located at label value', function () {
        it('Should return label value list', function () {
            var session = getSessionStub({
                currentToken: {
                    type: 'string.quoted.label-matcher',
                    value: '"n"',
                    index: 4,
                    start: 13,
                },
                tokens: [
                    { type: 'identifier', value: 'node_cpu' },
                    { type: 'paren.lparen.label-matcher', value: '{' },
                    { type: 'entity.name.tag.label-matcher', value: 'job' },
                    { type: 'keyword.operator.label-matcher', value: '=' },
                    {
                        type: 'string.quoted.label-matcher',
                        value: '"n"',
                        index: 4,
                        start: 13,
                    },
                    { type: 'paren.rparen.label-matcher', value: '}' },
                ],
                line: 'node_cpu{job="n"}',
            });
            return completer.getCompletions(editor, session, { row: 0, column: 15 }, 'n', function (s, res) {
                expect(res[0].meta).toEqual('label value');
            });
        });
    });
    describe('When inside by', function () {
        it('Should return label name list', function () {
            var session = getSessionStub({
                currentToken: {
                    type: 'entity.name.tag.label-list-matcher',
                    value: 'm',
                    index: 9,
                    start: 22,
                },
                tokens: [
                    { type: 'paren.lparen', value: '(' },
                    { type: 'keyword', value: 'count' },
                    { type: 'paren.lparen', value: '(' },
                    { type: 'identifier', value: 'node_cpu' },
                    { type: 'paren.rparen', value: '))' },
                    { type: 'text', value: ' ' },
                    { type: 'keyword.control', value: 'by' },
                    { type: 'text', value: ' ' },
                    { type: 'paren.lparen.label-list-matcher', value: '(' },
                    {
                        type: 'entity.name.tag.label-list-matcher',
                        value: 'm',
                        index: 9,
                        start: 22,
                    },
                    { type: 'paren.rparen.label-list-matcher', value: ')' },
                ],
                line: '(count(node_cpu)) by (m)',
            });
            return completer.getCompletions(editor, session, { row: 0, column: 23 }, 'm', function (s, res) {
                expect(res[0].meta).toEqual('label name');
            });
        });
    });
});
//# sourceMappingURL=completer.test.js.map