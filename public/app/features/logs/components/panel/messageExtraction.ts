/**
 * Priority-ordered list of common message field names across logging frameworks.
 * 'body' excluded — collides with OTLP where body is already the raw content.
 */
const MESSAGE_FIELD_NAMES = [
  'message', // winston, zerolog, Python, Log4j2, Logback, ECS/Kibana, Datadog, Better Stack
  'msg', // pino, bunyan, Go slog, Go zap
  'event', // Python structlog
  '@m', // .NET Serilog CompactJsonFormatter (rendered)
  '@mt', // .NET Serilog CompactJsonFormatter (template)
  'RenderedMessage', // .NET Serilog JsonFormatter
  'log', // Docker container logs, Fluentd/Fluent Bit
  'text', // generic variant
];

/**
 * Nested lookup: only event.message (structlog pattern),
 * and only when the parent is an object (avoids { "event": "login" } false positive).
 */
const NESTED_MESSAGE_PATHS: Array<{ parent: string; child: string }> = [{ parent: 'event', child: 'message' }];

export interface MessageExtractionResult {
  message: string | null;
  messageFieldName: string | null;
  parsed: Record<string, unknown> | null;
}

const NULL_RESULT: MessageExtractionResult = { message: null, messageFieldName: null, parsed: null };

export function extractMessageFromJSON(raw: string): MessageExtractionResult {
  // Pre-check: skip parse if it doesn't look like JSON
  const trimmed = raw.trimStart();
  if (trimmed.length === 0 || (trimmed[0] !== '{' && trimmed[0] !== '[')) {
    return NULL_RESULT;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NULL_RESULT;
  }

  // Must be a non-null object (not an array)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return NULL_RESULT;
  }

  const obj: Record<string, unknown> = Object(parsed);

  // Top-level field lookup (deterministic priority order)
  for (const fieldName of MESSAGE_FIELD_NAMES) {
    const value = obj[fieldName];
    const message = coerceToMessage(value);
    if (message !== null) {
      return { message, messageFieldName: fieldName, parsed: obj };
    }
  }

  // Nested lookup (conservative: only known patterns)
  for (const { parent, child } of NESTED_MESSAGE_PATHS) {
    const parentValue = obj[parent];
    if (typeof parentValue === 'object' && parentValue !== null && !Array.isArray(parentValue)) {
      const nested: unknown = Object(parentValue)[child];
      const message = coerceToMessage(nested);
      if (message !== null) {
        return { message, messageFieldName: parent, parsed: obj };
      }
    }
  }

  return { ...NULL_RESULT, parsed: obj };
}

function coerceToMessage(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.length >= 2 ? value : null;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return null;
}
