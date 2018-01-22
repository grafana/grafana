import { describe, it, sinon, expect } from 'test/lib/common';

import { PromCompleter } from '../completer';
import { PrometheusDatasource } from '../datasource';

describe('Prometheus editor completer', function() {
  function getSessionStub(data) {
    return {
      getTokenAt: sinon.stub().returns(data.currentToken),
      getTokens: sinon.stub().returns(data.tokens),
      getLine: sinon.stub().returns(data.line),
    };
  }

  let editor = {};
  let datasourceStub = <PrometheusDatasource>{
    performInstantQuery: sinon
      .stub()
      .withArgs({ expr: '{__name__="node_cpu"' })
      .returns(
        Promise.resolve({
          data: {
            data: {
              result: [
                {
                  metric: {
                    job: 'node',
                    instance: 'localhost:9100',
                  },
                },
              ],
            },
          },
        })
      ),
    performSuggestQuery: sinon
      .stub()
      .withArgs('node', true)
      .returns(Promise.resolve(['node_cpu'])),
  };

  let completer = new PromCompleter(datasourceStub);

  describe('When inside brackets', () => {
    it('Should return range vectors', () => {
      const session = getSessionStub({
        currentToken: { type: 'paren.lparen', value: '[', index: 2, start: 9 },
        tokens: [{ type: 'identifier', value: 'node_cpu' }, { type: 'paren.lparen', value: '[' }],
        line: 'node_cpu[',
      });

      return completer.getCompletions(editor, session, { row: 0, column: 10 }, '[', (s, res) => {
        expect(res[0].caption).to.eql('$__interval');
        expect(res[0].value).to.eql('[$__interval');
        expect(res[0].meta).to.eql('range vector');
      });
    });
  });

  describe('When inside label matcher, and located at label name', () => {
    it('Should return label name list', () => {
      const session = getSessionStub({
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

      return completer.getCompletions(editor, session, { row: 0, column: 10 }, 'j', (s, res) => {
        expect(res[0].meta).to.eql('label name');
      });
    });
  });

  describe('When inside label matcher, and located at label name with __name__ match', () => {
    it('Should return label name list', () => {
      const session = getSessionStub({
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

      return completer.getCompletions(editor, session, { row: 0, column: 23 }, 'j', (s, res) => {
        expect(res[0].meta).to.eql('label name');
      });
    });
  });

  describe('When inside label matcher, and located at label value', () => {
    it('Should return label value list', () => {
      const session = getSessionStub({
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

      return completer.getCompletions(editor, session, { row: 0, column: 15 }, 'n', (s, res) => {
        expect(res[0].meta).to.eql('label value');
      });
    });
  });

  describe('When inside by', () => {
    it('Should return label name list', () => {
      const session = getSessionStub({
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

      return completer.getCompletions(editor, session, { row: 0, column: 23 }, 'm', (s, res) => {
        expect(res[0].meta).to.eql('label name');
      });
    });
  });
});
