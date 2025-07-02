import Prism, { Token } from 'prismjs';

import { createLogLine } from '../mocks/logRow';

import { generateLogGrammar } from './grammar';

describe('generateLogGrammar', () => {
  function generateScenario(entry: string) {
    const log = createLogLine({ labels: { place: 'luna', source: 'logs' }, entry });
    const grammar = generateLogGrammar(log);
    const tokens = Prism.tokenize(log.entry, grammar);
    return { log, grammar, tokens };
  }

  test('Identifies uuid tokens', () => {
    const { tokens } = generateScenario('15f77b91-aedb-48d2-a551-ca4a7927cea4');
    if (tokens[0] instanceof Token) {
      expect(tokens).toHaveLength(1);
      expect(tokens[0].content).toBe('15f77b91-aedb-48d2-a551-ca4a7927cea4');
      expect(tokens[0].type).toBe('log-token-uuid');
    }
    expect.hasAssertions();
  });

  test('Identifies json keys and quoted values', () => {
    const { tokens } = generateScenario('{"key":"value", "key2":"value2"}');
    if (tokens[1] instanceof Token) {
      expect(tokens[1].content).toBe('"key"');
      expect(tokens[1].type).toBe('log-token-json-key');
    }
    if (tokens[3] instanceof Token) {
      expect(tokens[3].content).toBe('"value"');
      expect(tokens[3].type).toBe('log-token-string');
    }
    if (tokens[5] instanceof Token) {
      expect(tokens[5].content).toBe('"key2"');
      expect(tokens[5].type).toBe('log-token-json-key');
    }
    if (tokens[7] instanceof Token) {
      expect(tokens[7].content).toBe('"value2"');
      expect(tokens[7].type).toBe('log-token-string');
    }
    expect.assertions(8);
  });

  test('Identifies sizes', () => {
    const { tokens } = generateScenario('1mb 2 KB');
    if (tokens[0] instanceof Token) {
      expect(tokens[0].content).toBe('1mb');
      expect(tokens[0].type).toBe('log-token-size');
    }
    if (tokens[2] instanceof Token) {
      expect(tokens[2].content).toBe('2 KB');
      expect(tokens[2].type).toBe('log-token-size');
    }
    expect.assertions(4);
  });

  test('Identifies durations', () => {
    const { tokens } = generateScenario('1ms 2µs 1h');
    if (tokens[0] instanceof Token) {
      expect(tokens[0].content).toBe('1ms');
      expect(tokens[0].type).toBe('log-token-duration');
    }
    if (tokens[2] instanceof Token) {
      expect(tokens[2].content).toBe('2µs');
      expect(tokens[2].type).toBe('log-token-duration');
    }
    if (tokens[4] instanceof Token) {
      expect(tokens[4].content).toBe('1h');
      expect(tokens[4].type).toBe('log-token-duration');
    }
    expect.assertions(6);
  });

  test.each(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'])(
    'Identifies HTTP methods',
    (method: string) => {
      const { tokens } = generateScenario(`200 "${method} /whatever HTTP/1.1" 295`);
      if (tokens[1] instanceof Token) {
        expect(tokens[1].content).toBe(method);
        expect(tokens[1].type).toBe('log-token-method');
      }
      expect.assertions(2);
    }
  );
});
