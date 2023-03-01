import Prism, { Token } from 'prismjs';
import { Value } from 'slate';

import { TypeaheadOutput } from '@grafana/ui';

import { CloudWatchDatasource } from '../../datasource';
import { ResourceResponse } from '../../resources/types';
import { LogGroupField } from '../../types';

import { CloudWatchLogsLanguageProvider } from './CloudWatchLogsLanguageProvider';
import {
  AGGREGATION_FUNCTIONS_STATS,
  BOOLEAN_FUNCTIONS,
  DATETIME_FUNCTIONS,
  IP_FUNCTIONS,
  NUMERIC_OPERATORS,
  QUERY_COMMANDS,
  STRING_FUNCTIONS,
  FIELD_AND_FILTER_FUNCTIONS,
} from './syntax';

const fields = ['field1', '@message'];

describe('CloudWatchLogsLanguageProvider', () => {
  it('should suggest ', async () => {
    await runSuggestionTest('stats count(^)', [fields]);
    // Make sure having a field prefix does not brake anything
    await runSuggestionTest('stats count(@mess^)', [fields]);
  });

  it('should suggest query commands on start of query', async () => {
    await runSuggestionTest('^', [QUERY_COMMANDS.map((v) => v.label)]);
  });

  it('should suggest query commands after pipe', async () => {
    await runSuggestionTest('fields f | ^', [QUERY_COMMANDS.map((v) => v.label)]);
  });

  it('should suggest fields and functions after field command', async () => {
    await runSuggestionTest('fields ^', [fields, FIELD_AND_FILTER_FUNCTIONS.map((v) => v.label)]);
  });

  it('should suggest fields and functions after comma', async () => {
    await runSuggestionTest('fields field1, ^', [fields, FIELD_AND_FILTER_FUNCTIONS.map((v) => v.label)]);
  });

  it('should suggest fields and functions after comma with prefix', async () => {
    await runSuggestionTest('fields field1, @mess^', [fields, FIELD_AND_FILTER_FUNCTIONS.map((v) => v.label)]);
  });

  it('should suggest fields and functions after display command', async () => {
    await runSuggestionTest('display ^', [fields, FIELD_AND_FILTER_FUNCTIONS.map((v) => v.label)]);
  });

  it('should suggest functions after stats command', async () => {
    await runSuggestionTest('stats ^', [AGGREGATION_FUNCTIONS_STATS.map((v) => v.label)]);
  });

  it('should suggest fields and some functions after `by` command', async () => {
    await runSuggestionTest('stats count(something) by ^', [
      fields,
      STRING_FUNCTIONS.concat(DATETIME_FUNCTIONS, IP_FUNCTIONS).map((v) => v.label),
    ]);
  });

  it('should suggest fields and some functions after comparison operator', async () => {
    await runSuggestionTest('filter field1 >= ^', [
      fields,
      [...NUMERIC_OPERATORS.map((v) => v.label), ...BOOLEAN_FUNCTIONS.map((v) => v.label)],
    ]);
  });

  it('should suggest fields directly after sort', async () => {
    await runSuggestionTest('sort ^', [fields]);
  });

  it('should suggest fields directly after sort after a pipe', async () => {
    await runSuggestionTest('fields field1 | sort ^', [fields]);
  });

  it('should suggest sort order after sort command and field', async () => {
    await runSuggestionTest('sort field1 ^', [['asc', 'desc']]);
  });

  it('should suggest fields directly after parse', async () => {
    await runSuggestionTest('parse ^', [fields]);
  });

  it('should suggest fields and bool functions after filter', async () => {
    await runSuggestionTest('filter ^', [fields, BOOLEAN_FUNCTIONS.map((v) => v.label)]);
  });

  it('should suggest fields and functions after filter bin() function', async () => {
    await runSuggestionTest('stats count(@message) by bin(30m), ^', [
      fields,
      STRING_FUNCTIONS.concat(DATETIME_FUNCTIONS, IP_FUNCTIONS).map((v) => v.label),
    ]);
  });

  it('should not suggest anything if not after comma in by expression', async () => {
    await runSuggestionTest('stats count(@message) by bin(30m) ^', []);
  });
});

async function runSuggestionTest(query: string, expectedItems: string[][]) {
  const result = await getProvideCompletionItems(query);
  expectedItems.forEach((items, index) => {
    expect(result.suggestions[index].items.map((item) => item.label)).toEqual(items);
  });
}

function makeDatasource(): CloudWatchDatasource {
  return {
    resources: {
      getLogGroupFields(): Promise<Array<ResourceResponse<LogGroupField>>> {
        return Promise.resolve([{ value: { name: 'field1' } }, { value: { name: '@message' } }]);
      },
    },
    /* eslint-disable @typescript-eslint/no-explicit-any */
  } as any;
}

/**
 * Get suggestion items based on query. Use `^` to mark position of the cursor.
 */
function getProvideCompletionItems(query: string): Promise<TypeaheadOutput> {
  const provider = new CloudWatchLogsLanguageProvider(makeDatasource());
  const cursorOffset = query.indexOf('^');
  const queryWithoutCursor = query.replace('^', '');
  let tokens: Token[] = Prism.tokenize(queryWithoutCursor, provider.getSyntax()) as any;
  tokens = addTokenMetadata(tokens);
  const value = new ValueMock(tokens, cursorOffset);
  return provider.provideCompletionItems(
    {
      value,
      /* eslint-disable @typescript-eslint/no-explicit-any */
    } as any,
    { logGroups: [{ name: 'logGroup1', arn: 'logGroup1' }], region: 'custom' }
  );
}

class ValueMock {
  selection: Value['selection'];
  data: Value['data'];

  constructor(tokens: Array<string | Token>, cursorOffset: number) {
    this.selection = {
      start: {
        offset: cursorOffset,
      },
      /* eslint-disable @typescript-eslint/no-explicit-any */
    } as any;

    this.data = {
      get() {
        return tokens;
      },
      /* eslint-disable @typescript-eslint/no-explicit-any */
    } as any;
  }
}

/**
 * Adds some Slate specific metadata
 * @param tokens
 */
function addTokenMetadata(tokens: Array<string | Token>): Token[] {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let prev = undefined as any;
  let offset = 0;
  return tokens.reduce((acc, token) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let newToken: any;
    if (typeof token === 'string') {
      newToken = {
        content: token,
        // Not sure what else could it be here, probably if we do not match something
        types: ['whitespace'],
      };
    } else {
      newToken = { ...token };
      newToken.types = [token.type];
    }
    newToken.prev = prev;
    if (newToken.prev) {
      newToken.prev.next = newToken;
    }
    const end = offset + token.length;
    newToken.offsets = {
      start: offset,
      end,
    };
    prev = newToken;
    offset = end;
    return [...acc, newToken];
  }, [] as Token[]);
}
