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
import Prism, { Grammar } from 'prismjs';

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

  isStatsQuery(query: string): boolean {
    const grammar = Prism.languages['cloudwatch'];
    const tokens = Prism.tokenize(query, grammar) ?? [];

    return !!tokens.find(
      token =>
        typeof token !== 'string' &&
        token.content.toString().toLowerCase() === 'stats' &&
        token.type === 'query-command'
    );
  }

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

    const isFirstToken = !curToken.prev;
    const prevToken = prevNonWhitespaceToken(curToken);

    const isCommandStart = isFirstToken || (!isFirstToken && prevToken?.types.includes('command-separator'));
    if (isCommandStart) {
      return this.getCommandCompletionItems();
    }

    if (isInsideFunctionParenthesis(curToken)) {
      return await this.getFieldCompletionItems(context?.logGroupNames ?? []);
    }

    if (isAfterKeyword('by', curToken)) {
      return this.handleKeyword(context);
    }

    if (prevToken?.types.includes('comparison-operator')) {
      return this.handleComparison(context);
    }

    const commandToken = previousCommandToken(curToken);
    if (commandToken) {
      return await this.handleCommand(commandToken, curToken, context);
    }

    return {
      suggestions: [],
    };
  }

  private fetchedFieldsCache:
    | {
        time: number;
        logGroups: string[];
        fields: string[];
      }
    | undefined;

  private fetchFields = async (logGroups: string[]): Promise<string[]> => {
    if (
      this.fetchedFieldsCache &&
      Date.now() - this.fetchedFieldsCache.time < 30 * 1000 &&
      _.sortedUniq(this.fetchedFieldsCache.logGroups).join('|') === _.sortedUniq(logGroups).join('|')
    ) {
      return this.fetchedFieldsCache.fields;
    }

    const results = await Promise.all(
      logGroups.map(logGroup => this.datasource.getLogGroupFields({ logGroupName: logGroup }))
    );

    const fields = [
      ...new Set<string>(
        results.reduce((acc: string[], cur) => acc.concat(cur.logGroupFields?.map(f => f.name) as string[]), [])
      ).values(),
    ];

    this.fetchedFieldsCache = {
      time: Date.now(),
      logGroups,
      fields,
    };

    return fields;
  };

  private handleKeyword = async (context?: TypeaheadContext): Promise<TypeaheadOutput | null> => {
    const suggs = await this.getFieldCompletionItems(context?.logGroupNames ?? []);
    const functionSuggestions = [
      { prefixMatch: true, label: 'Functions', items: STRING_FUNCTIONS.concat(DATETIME_FUNCTIONS, IP_FUNCTIONS) },
    ];
    suggs.suggestions.push(...functionSuggestions);

    return suggs;
  };

  private handleCommand = async (
    commandToken: Token,
    curToken: Token,
    context: TypeaheadContext
  ): Promise<TypeaheadOutput> => {
    const queryCommand = commandToken.content.toLowerCase();
    const prevToken = prevNonWhitespaceToken(curToken);
    const currentTokenIsFirstArg = prevToken === commandToken;

    if (queryCommand === 'sort') {
      return this.handleSortCommand(currentTokenIsFirstArg, curToken, context);
    }

    if (queryCommand === 'parse') {
      if (currentTokenIsFirstArg) {
        return await this.getFieldCompletionItems(context.logGroupNames ?? []);
      }
    }

    const currentTokenIsAfterCommandAndEmpty =
      commandToken.next?.types.includes('whitespace') && !commandToken.next.next;
    const currentTokenIsAfterCommand =
      currentTokenIsAfterCommandAndEmpty || nextNonWhitespaceToken(commandToken) === curToken;

    const currentTokenIsComma = curToken.content === ',' && curToken.types.includes('punctuation');
    const currentTokenIsCommaOrAfterComma =
      currentTokenIsComma || (prevToken?.content === ',' && prevToken?.types.includes('punctuation'));

    // We only show suggestions if we are after a command or after a comma which is a field separator
    if (!(currentTokenIsAfterCommand || currentTokenIsCommaOrAfterComma)) {
      return { suggestions: [] };
    }

    if (['display', 'fields'].includes(queryCommand)) {
      const typeaheadOutput = await this.getFieldCompletionItems(context.logGroupNames ?? []);
      typeaheadOutput.suggestions.push(...this.getFunctionCompletionItems().suggestions);

      return typeaheadOutput;
    }

    if (queryCommand === 'stats') {
      const typeaheadOutput = this.getStatsAggCompletionItems();
      if (currentTokenIsComma || currentTokenIsAfterCommandAndEmpty) {
        typeaheadOutput?.suggestions.forEach(group => {
          group.skipFilter = true;
        });
      }
      return typeaheadOutput;
    }

    if (queryCommand === 'filter' && currentTokenIsFirstArg) {
      const sugg = await this.getFieldCompletionItems(context.logGroupNames ?? []);
      const boolFuncs = this.getBoolFuncCompletionItems();
      sugg.suggestions.push(...boolFuncs.suggestions);
      return sugg;
    }
    return { suggestions: [] };
  };

  private async handleSortCommand(
    isFirstArgument: boolean,
    curToken: Token,
    context: TypeaheadContext
  ): Promise<TypeaheadOutput> {
    if (isFirstArgument) {
      return await this.getFieldCompletionItems(context.logGroupNames ?? []);
    } else if (prevNonWhitespaceToken(curToken)?.types.includes('field-name')) {
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

    return { suggestions: [] };
  }

  private handleComparison = async (context?: TypeaheadContext) => {
    const fieldsSuggestions = await this.getFieldCompletionItems(context?.logGroupNames ?? []);
    const boolFuncSuggestions = this.getBoolFuncCompletionItems();
    const numFuncSuggestions = this.getNumericFuncCompletionItems();

    fieldsSuggestions.suggestions.push(...boolFuncSuggestions.suggestions, ...numFuncSuggestions.suggestions);
    return fieldsSuggestions;
  };

  private getCommandCompletionItems = (): TypeaheadOutput => {
    return { suggestions: [{ prefixMatch: true, label: 'Commands', items: QUERY_COMMANDS }] };
  };

  private getFunctionCompletionItems = (): TypeaheadOutput => {
    return { suggestions: [{ prefixMatch: true, label: 'Functions', items: FUNCTIONS }] };
  };

  private getStatsAggCompletionItems = (): TypeaheadOutput => {
    return { suggestions: [{ prefixMatch: true, label: 'Functions', items: AGGREGATION_FUNCTIONS_STATS }] };
  };

  private getBoolFuncCompletionItems = (): TypeaheadOutput => {
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

  private getNumericFuncCompletionItems = (): TypeaheadOutput => {
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

  private getFieldCompletionItems = async (logGroups: string[]): Promise<TypeaheadOutput> => {
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

function previousCommandToken(startToken: Token): Token | null {
  let thisToken = startToken;
  while (!!thisToken.prev) {
    thisToken = thisToken.prev;
    if (
      thisToken.types.includes('query-command') &&
      (!thisToken.prev || prevNonWhitespaceToken(thisToken)?.types.includes('command-separator'))
    ) {
      return thisToken;
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

function isAfterKeyword(keyword: string, token: Token): boolean {
  const prevToken = prevNonWhitespaceToken(token);
  return prevToken?.types.includes('keyword') && prevToken?.content.toLowerCase() === 'by';
}
