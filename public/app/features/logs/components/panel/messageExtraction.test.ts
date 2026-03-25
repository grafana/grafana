import { extractMessageFromJSON } from './messageExtraction';

describe('extractMessageFromJSON', () => {
  it('extracts "message" field (winston, ECS, zerolog)', () => {
    const raw = JSON.stringify({ level: 'info', message: 'HTTP request completed', method: 'GET' });
    const result = extractMessageFromJSON(raw);
    expect(result.message).toBe('HTTP request completed');
    expect(result.messageFieldName).toBe('message');
    expect(result.parsed).toEqual({ level: 'info', message: 'HTTP request completed', method: 'GET' });
  });

  it('extracts "msg" field (pino, Go slog/zap)', () => {
    const raw = JSON.stringify({ level: 30, msg: 'Server started', port: 3000 });
    const result = extractMessageFromJSON(raw);
    expect(result.message).toBe('Server started');
  });

  it('extracts "event" field (Python structlog)', () => {
    const raw = JSON.stringify({ event: 'user_login', user_id: 42 });
    const result = extractMessageFromJSON(raw);
    expect(result.message).toBe('user_login');
  });

  it('extracts "@m" field (Serilog CompactJsonFormatter)', () => {
    const raw = JSON.stringify({ '@t': '2024-01-01T00:00:00Z', '@m': 'Processing request', '@l': 'Information' });
    const result = extractMessageFromJSON(raw);
    expect(result.message).toBe('Processing request');
  });

  it('extracts "@mt" field (Serilog template)', () => {
    const raw = JSON.stringify({ '@t': '2024-01-01T00:00:00Z', '@mt': 'Processing {RequestId}', '@l': 'Information' });
    const result = extractMessageFromJSON(raw);
    expect(result.message).toBe('Processing {RequestId}');
  });

  it('extracts "RenderedMessage" field (Serilog JsonFormatter)', () => {
    const raw = JSON.stringify({ Timestamp: '2024-01-01', RenderedMessage: 'Request processed', Level: 'Info' });
    const result = extractMessageFromJSON(raw);
    expect(result.message).toBe('Request processed');
  });

  it('extracts "log" field (Docker container logs)', () => {
    const raw = JSON.stringify({ log: 'Container started successfully', stream: 'stdout' });
    const result = extractMessageFromJSON(raw);
    expect(result.message).toBe('Container started successfully');
  });

  it('extracts "text" field (generic)', () => {
    const raw = JSON.stringify({ text: 'Something happened', code: 200 });
    const result = extractMessageFromJSON(raw);
    expect(result.message).toBe('Something happened');
  });

  it('respects priority order: "message" before "msg"', () => {
    const raw = JSON.stringify({ msg: 'lower priority', message: 'higher priority' });
    const result = extractMessageFromJSON(raw);
    expect(result.message).toBe('higher priority');
  });

  it('returns null for JSON without a known message field', () => {
    const raw = JSON.stringify({ level: 'info', status: 200, path: '/api/users' });
    const result = extractMessageFromJSON(raw);
    expect(result.message).toBeNull();
    expect(result.messageFieldName).toBeNull();
    expect(result.parsed).toEqual({ level: 'info', status: 200, path: '/api/users' });
  });

  it('returns null for plain text (non-JSON)', () => {
    const result = extractMessageFromJSON('Just a plain log line');
    expect(result.message).toBeNull();
    expect(result.parsed).toBeNull();
  });

  it('returns null for logfmt', () => {
    const result = extractMessageFromJSON('level=info msg="hello world" ts=1234567890');
    expect(result.message).toBeNull();
    expect(result.parsed).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    const result = extractMessageFromJSON('{ broken json');
    expect(result.message).toBeNull();
    expect(result.parsed).toBeNull();
  });

  it('returns null for JSON arrays', () => {
    const result = extractMessageFromJSON('[1, 2, 3]');
    expect(result.message).toBeNull();
    expect(result.parsed).toBeNull();
  });

  it('extracts nested event.message (structlog object parent)', () => {
    const raw = JSON.stringify({ event: { message: 'Nested event message', code: 42 }, ts: 123 });
    const result = extractMessageFromJSON(raw);
    expect(result.message).toBe('Nested event message');
    expect(result.messageFieldName).toBe('event');
  });

  it('does NOT use nested lookup when parent is a string', () => {
    const raw = JSON.stringify({ event: 'login', ts: 123 });
    const result = extractMessageFromJSON(raw);
    // "event" as string is valid for top-level lookup
    expect(result.message).toBe('login');
  });

  it('returns null for empty/short message strings', () => {
    const raw = JSON.stringify({ message: 'x' });
    const result = extractMessageFromJSON(raw);
    expect(result.message).toBeNull();
  });

  it('returns null for empty string message', () => {
    const raw = JSON.stringify({ message: '' });
    const result = extractMessageFromJSON(raw);
    expect(result.message).toBeNull();
  });

  it('coerces numeric message to string', () => {
    const raw = JSON.stringify({ message: 42 });
    const result = extractMessageFromJSON(raw);
    expect(result.message).toBe('42');
  });

  it('ignores object/array message values', () => {
    const raw = JSON.stringify({ message: { nested: true }, msg: 'fallback' });
    const result = extractMessageFromJSON(raw);
    expect(result.message).toBe('fallback');
  });

  it('ignores array message values', () => {
    const raw = JSON.stringify({ message: [1, 2, 3] });
    const result = extractMessageFromJSON(raw);
    expect(result.message).toBeNull();
  });

  it('handles JSON with leading whitespace', () => {
    const raw = '  {"message": "with whitespace"}';
    const result = extractMessageFromJSON(raw);
    expect(result.message).toBe('with whitespace');
  });

  it('returns null for empty string input', () => {
    const result = extractMessageFromJSON('');
    expect(result.message).toBeNull();
    expect(result.parsed).toBeNull();
  });
});
