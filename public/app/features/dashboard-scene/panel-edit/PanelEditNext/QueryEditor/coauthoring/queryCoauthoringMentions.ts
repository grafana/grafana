import { type QueryEditorCoauthoringContextV1 } from './internalCoauthoringContract';

export interface QueryCoauthoringMentionOption {
  kind: 'metric' | 'label';
  name: string;
}

export interface QueryCoauthoringMention {
  from: number;
  to: number;
  query: string;
  selectedIndex: number;
}

export interface QueryCoauthoringMentionMenu {
  options: QueryCoauthoringMentionOption[];
  selectedIndex: number;
  move(direction: 1 | -1): void;
  select(index?: number): void;
}

export function findQueryCoauthoringMention(intent: string, caret: number): QueryCoauthoringMention | undefined {
  const prefix = intent.slice(0, caret);
  const match = /(?:^|\s)@([^\s@]*)$/.exec(prefix);
  return match ? { from: prefix.lastIndexOf('@'), to: caret, query: match[1], selectedIndex: 0 } : undefined;
}

export function queryCoauthoringMentionOptions(
  context: QueryEditorCoauthoringContextV1 | undefined,
  query: string
): QueryCoauthoringMentionOption[] {
  const options: QueryCoauthoringMentionOption[] = [];
  const seen = new Set<string>();
  for (const item of context?.metadata ?? []) {
    if ((item.kind !== 'metric' && item.kind !== 'label') || !item.name.toLowerCase().includes(query.toLowerCase())) {
      continue;
    }
    const key = `${item.kind}:${item.name}`;
    if (!seen.has(key)) {
      options.push({ kind: item.kind, name: item.name });
      seen.add(key);
    }
    if (options.length === 6) {
      break;
    }
  }
  return options;
}
