import {
  FOLLOW_UP_RESPONSES,
  GENERATE_PANEL_OUTPUTS,
  GENERATED_SQL_SNIPPETS,
  GENERIC_EXPLANATION,
  NATIVE_BLOCK_EXPLANATION,
  PANEL_QUESTION_RESPONSES,
} from './cannedResponses';

export type AiKind = 'explain' | 'generate' | 'panel-question' | 'generate-panel';

export interface AiRequest {
  kind: AiKind;
  payload: string;
}

export interface GeneratedPanel {
  sql: string;
  vizType: 'timeseries' | 'barchart' | 'stat' | 'bargauge';
}

// Yields tokens from a string with a realistic typing cadence
async function* stream(text: string, delayMs = 18): AsyncGenerator<string> {
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    const chunk = (i === 0 ? '' : ' ') + words[i];
    yield chunk;
    await delay(delayMs + Math.random() * 20);
  }
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function* askAiStream(req: AiRequest): AsyncGenerator<string> {
  // Simulate network latency
  await delay(300 + Math.random() * 200);

  switch (req.kind) {
    case 'explain': {
      const text = /histogram_quantile|native\s*\(/.test(req.payload)
        ? NATIVE_BLOCK_EXPLANATION
        : GENERIC_EXPLANATION(req.payload);
      yield* stream(text);
      break;
    }

    case 'generate': {
      const lower = req.payload.toLowerCase();
      let sql = GENERATED_SQL_SNIPPETS['default'];
      if (lower.includes('p99') || lower.includes('latency') || lower.includes('percentile')) {
        sql = GENERATED_SQL_SNIPPETS['p99 latency'];
      } else if (lower.includes('error')) {
        sql = GENERATED_SQL_SNIPPETS['error rate'];
      } else if (lower.includes('top') || lower.includes('endpoint')) {
        sql = GENERATED_SQL_SNIPPETS['top 5 endpoints'];
      }
      yield* stream(sql, 8);
      break;
    }

    case 'panel-question': {
      await delay(400);
      const lower = req.payload.toLowerCase();
      let response = PANEL_QUESTION_RESPONSES['default'];
      for (const [key, val] of Object.entries(PANEL_QUESTION_RESPONSES)) {
        if (lower.includes(key.toLowerCase())) {
          response = val;
          break;
        }
      }
      yield* stream(response);
      break;
    }

    case 'generate-panel': {
      await delay(800 + Math.random() * 400);
      const lower = req.payload.toLowerCase();
      const match =
        GENERATE_PANEL_OUTPUTS.find((o) => lower.includes(o.prompt)) ?? GENERATE_PANEL_OUTPUTS[0];
      yield JSON.stringify({ sql: match.sql, vizType: match.vizType });
      break;
    }

    default:
      yield 'I can help with SQL queries, data explanations, and panel generation.';
  }
}

export function getFollowUpResponse(question: string): string {
  const lower = question.toLowerCase();
  for (const [key, val] of Object.entries(FOLLOW_UP_RESPONSES)) {
    if (lower.includes(key)) {
      return val;
    }
  }
  return FOLLOW_UP_RESPONSES['default'];
}

export const SUGGESTED_FOLLOW_UPS = [
  'Why is it spiking?',
  'Compare to last week',
  'Show as percentage',
];
