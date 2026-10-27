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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function queryCoauthoringMentionOptions(
  context: QueryEditorCoauthoringContextV1 | undefined,
  query: string
): QueryCoauthoringMentionOption[] {
  const metadata = context?.metadata ?? [];
  const needle = query.toLowerCase();
  const options: QueryCoauthoringMentionOption[] = [];
  const seen = new Set<string>();
  const addOption = (kind: QueryCoauthoringMentionOption['kind'], name: string) => {
    const key = `${kind}:${name}`;
    if (name.toLowerCase().includes(needle) && !seen.has(key)) {
      options.push({ kind, name });
      seen.add(key);
    }
  };
  for (const item of metadata) {
    if (item.kind === 'metric') {
      addOption('metric', item.name);
    }
  }
  for (const item of metadata) {
    if (item.kind === 'label') {
      addOption('label', item.name);
    } else if (item.kind === 'metric') {
      const labels = item.attributes?.labels;
      if (isStringArray(labels)) {
        for (const name of labels) {
          addOption('label', name);
        }
      }
    }
  }
  return options.slice(0, 6);
}
