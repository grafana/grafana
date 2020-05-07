// Libraries
import _ from 'lodash';

// Services & Utils
import syntax, {
  QUERY_COMMANDS,
  FUNCTIONS,
  AGGREGATION_FUNCTIONS_STATS,
  STRING_FUNCTIONS,
  DATETIME_FUNCTIONS,
  IP_FUNCTIONS,
  BOOLEAN_FUNCTIONS,
  NUMERIC_OPERATORS,
} from './syntax';

// Types
import { CloudWatchQuery } from './types';
import { AbsoluteTimeRange, LanguageProvider, HistoryItem } from '@grafana/data';

import { CloudWatchDatasource } from './datasource';
import { TypeaheadInput, TypeaheadOutput, Token } from '@grafana/ui';
import { Grammar } from 'prismjs';

export type CloudWatchHistoryItem = HistoryItem<CloudWatchQuery>;

type TypeaheadContext = {
  history?: CloudWatchHistoryItem[];
  absoluteRange?: AbsoluteTimeRange;
  logGroupNames?: string[];
};

export class CloudWatchLanguageProvider extends LanguageProvider {
  started: boolean;
  initialRange: AbsoluteTimeRange;
  datasource: CloudWatchDatasource;

  constructor(datasource: CloudWatchDatasource, initialValues?: any) {
    super();

    this.datasource = datasource;

    Object.assign(this, initialValues);
  }

  // Strip syntax chars
  cleanText = (s: string) => s.replace(/[()]/g, '').trim();

  getSyntax(): Grammar {
    return syntax;
  }

  request = (url: string, params?: any): Promise<{ data: { data: string[] } }> => {
    return this.datasource.awsRequest(url, params);
  };

  start = () => {
    if (!this.startTask) {
      this.startTask = Promise.resolve().then(() => {
        this.started = true;
        return [];
      });
    }

    return this.startTask;
  };

  fetchFields = _.throttle(async (logGroups: string[]) => {
    const results = await Promise.all(
      logGroups.map(logGroup => this.datasource.getLogGroupFields({ logGroupName: logGroup }))
    );

    return [
      ...new Set<string>(
        results.reduce((acc: string[], cur) => acc.concat(cur.logGroupFields?.map(f => f.name) as string[]), [])
      ).values(),
    ];
  }, 30 * 1000);

  /**
   * Return suggestions based on input that can be then plugged into a typeahead dropdown.
   * Keep this DOM-free for testing
   * @param input
   * @param context Is optional in types but is required in case we are doing getLabelCompletionItems
   * @param context.absoluteRange Required in case we are doing getLabelCompletionItems
   * @param context.history Optional used only in getEmptyCompletionItems
   */
  async provideCompletionItems(input: TypeaheadInput, context?: TypeaheadContext): Promise<TypeaheadOutput> {
    const { value } = input;

    // Get tokens
    const tokens = value?.data.get('tokens');

    if (!tokens || !tokens.length) {
      return { suggestions: [] };
    }

    const curToken: Token = tokens.filter(
      (token: any) =>
        token.offsets.start <= value!.selection?.start?.offset && token.offsets.end >= value!.selection?.start?.offset
    )[0];

    const isFirstToken = curToken.prev === null || curToken.prev === undefined;
    const prevToken = prevNonWhitespaceToken(curToken);

    if (isInsideFunctionParenthesis(curToken)) {
      return await this.getFieldCompletionItems(context?.logGroupNames ?? []);
    }

    const isCommandStart = isFirstToken || (!isFirstToken && prevToken?.types.includes('command-separator'));
    if (isCommandStart) {
      return this.getCommandCompletionItems();
    } else if (!isFirstToken) {
      if (prevToken?.types.includes('keyword')) {
        return this.handleKeyword(prevToken, context);
      }

      if (prevToken?.types.includes('comparison-operator')) {
        const suggs = await this.getFieldCompletionItems(context?.logGroupNames ?? []);
        const boolFuncSuggs = this.getBoolFuncCompletionItems();
        const numFuncSuggs = this.getNumericFuncCompletionItems();

        suggs.suggestions.push(...boolFuncSuggs.suggestions, ...numFuncSuggs.suggestions);
        return suggs;
      }

      const commandToken = this.findCommandToken(curToken);

      if (commandToken !== null) {
        const typeaheadOutput = await this.handleCommand(commandToken, curToken, context);
        return typeaheadOutput;
      }
    }

    return {
      suggestions: [],
    };
  }

  handleKeyword = async (token: Token, context?: TypeaheadContext): Promise<TypeaheadOutput | null> => {
    if (token.content.toLowerCase() === 'by') {
      const suggs = await this.getFieldCompletionItems(context?.logGroupNames ?? []);
      const functionSuggestions = [
        { prefixMatch: true, label: 'Functions', items: STRING_FUNCTIONS.concat(DATETIME_FUNCTIONS, IP_FUNCTIONS) },
      ];
      suggs.suggestions.push(...functionSuggestions);

      return suggs;
    }

    return null;
  };

  handleCommand = async (commandToken: Token, curToken: Token, context: TypeaheadContext): Promise<TypeaheadOutput> => {
    const queryCommand = commandToken.content.toLowerCase();
    const prevToken = prevNonWhitespaceToken(curToken);
    const currentTokenIsFirstArg = prevToken === commandToken;

    if (queryCommand === 'sort') {
      if (currentTokenIsFirstArg) {
        return await this.getFieldCompletionItems(context.logGroupNames ?? []);
      } else if (prevToken?.types.includes('field-name')) {
        // suggest sort options
        return {
          suggestions: [
            {
              prefixMatch: true,
              label: 'Sort Order',
              items: [
                {
                  label: 'asc',
                },
                { label: 'desc' },
              ],
            },
          ],
        };
      }
    }

    if (queryCommand === 'parse') {
      if (currentTokenIsFirstArg) {
        return await this.getFieldCompletionItems(context.logGroupNames ?? []);
      }
    }

    let typeaheadOutput: TypeaheadOutput | null = null;
    if (
      (commandToken.next?.types.includes('whitespace') && commandToken.next.next === null) ||
      nextNonWhitespaceToken(commandToken) === curToken ||
      (curToken.content === ',' && curToken.types.includes('punctuation')) ||
      (curToken.prev?.content === ',' && curToken.prev.types.includes('punctuation'))
    ) {
      if (['display', 'fields'].includes(queryCommand)) {
        // Current token comes straight after command OR after comma
        typeaheadOutput = await this.getFieldCompletionItems(context.logGroupNames ?? []);
        typeaheadOutput.suggestions.push(...this.getFunctionCompletionItems().suggestions);

        return typeaheadOutput;
      } else if (queryCommand === 'stats') {
        typeaheadOutput = this.getStatsAggCompletionItems();
      } else if (queryCommand === 'filter') {
        if (currentTokenIsFirstArg) {
          const sugg = await this.getFieldCompletionItems(context.logGroupNames ?? []);
          const boolFuncs = this.getBoolFuncCompletionItems();
          sugg.suggestions.push(...boolFuncs.suggestions);
          return sugg;
        }
      }

      if (
        (curToken.content === ',' && curToken.types.includes('punctuation')) ||
        (commandToken.next?.types.includes('whitespace') && commandToken.next.next === null)
      ) {
        typeaheadOutput?.suggestions.forEach(group => {
          group.skipFilter = true;
        });
      }

      return typeaheadOutput!;
    }

    return { suggestions: [] };
  };

  findCommandToken = (startToken: Token): Token | null => {
    let thisToken = { ...startToken };

    while (thisToken.prev !== null) {
      thisToken = thisToken.prev;
      const isFirstCommand = thisToken.types.includes('query-command') && thisToken.prev === null;
      if (thisToken.types.includes('command-separator') || isFirstCommand) {
        // next token should be command
        if (!isFirstCommand && thisToken.next?.types.includes('query-command')) {
          return thisToken.next;
        } else {
          return thisToken;
        }
      }
    }

    return null;
  };

  getCommandCompletionItems = (): TypeaheadOutput => {
    return { suggestions: [{ prefixMatch: true, label: 'Commands', items: QUERY_COMMANDS }] };
  };

  getFunctionCompletionItems = (): TypeaheadOutput => {
    return { suggestions: [{ prefixMatch: true, label: 'Functions', items: FUNCTIONS }] };
  };

  getStatsAggCompletionItems = (): TypeaheadOutput => {
    return { suggestions: [{ prefixMatch: true, label: 'Functions', items: AGGREGATION_FUNCTIONS_STATS }] };
  };

  getBoolFuncCompletionItems = (): TypeaheadOutput => {
    return {
      suggestions: [
        {
          prefixMatch: true,
          label: 'Functions',
          items: BOOLEAN_FUNCTIONS,
        },
      ],
    };
  };

  getNumericFuncCompletionItems = (): TypeaheadOutput => {
    return {
      suggestions: [
        {
          prefixMatch: true,
          label: 'Functions',
          items: NUMERIC_OPERATORS,
        },
      ],
    };
  };

  getFieldCompletionItems = async (logGroups: string[]): Promise<TypeaheadOutput> => {
    const fields = await this.fetchFields(logGroups);

    return {
      suggestions: [
        {
          prefixMatch: true,
          label: 'Fields',
          items: fields.map(field => ({
            label: field,
            insertText: field.match(/@?[_a-zA-Z]+[_.0-9a-zA-Z]*/) ? field : `\`${field}\``,
          })),
        },
      ],
    };
  };
}

function nextNonWhitespaceToken(token: Token): Token | null {
  let curToken = token;

  while (curToken.next) {
    if (curToken.next.types.includes('whitespace')) {
      curToken = curToken.next;
    } else {
      return curToken.next;
    }
  }

  return null;
}

function prevNonWhitespaceToken(token: Token): Token | null {
  let curToken = token;

  while (curToken.prev) {
    if (curToken.prev.types.includes('whitespace')) {
      curToken = curToken.prev;
    } else {
      return curToken.prev;
    }
  }

  return null;
}

const funcsWithFieldArgs = [
  'avg',
  'count',
  'count_distinct',
  'earliest',
  'latest',
  'sortsFirst',
  'sortsLast',
  'max',
  'min',
  'pct',
  'stddev',
  'ispresent',
  'fromMillis',
  'toMillis',
  'isempty',
  'isblank',
  'isValidIp',
  'isValidIpV4',
  'isValidIpV6',
  'isIpInSubnet',
  'isIpv4InSubnet',
  'isIpv6InSubnet',
].map(funcName => funcName.toLowerCase());

/**
 * Returns true if cursor is currently inside a function parenthesis for example `count(|)` or `count(@mess|)` should
 * return true.
 */
function isInsideFunctionParenthesis(curToken: Token): boolean {
  const prevToken = prevNonWhitespaceToken(curToken);

  if (!prevToken) {
    return false;
  }

  const parenthesisToken = curToken.content === '(' ? curToken : prevToken.content === '(' ? prevToken : undefined;
  if (parenthesisToken) {
    const maybeFunctionToken = prevNonWhitespaceToken(parenthesisToken);
    if (maybeFunctionToken) {
      return (
        funcsWithFieldArgs.includes(maybeFunctionToken.content.toLowerCase()) &&
        maybeFunctionToken.types.includes('function')
      );
    }
  }
  return false;
}
