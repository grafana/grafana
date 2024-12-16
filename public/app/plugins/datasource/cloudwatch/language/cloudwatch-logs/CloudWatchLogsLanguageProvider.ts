import Prism, { Grammar } from 'prismjs';
import { lastValueFrom } from 'rxjs';

import { AbsoluteTimeRange, HistoryItem, LanguageProvider } from '@grafana/data';
import { BackendDataSourceResponse, FetchResponse, TemplateSrv, getTemplateSrv } from '@grafana/runtime';
import { CompletionItemGroup, SearchFunctionType, Token, TypeaheadInput, TypeaheadOutput } from '@grafana/ui';

import { CloudWatchDatasource } from '../../datasource';
import { CloudWatchQuery, LogGroup } from '../../types';
import { fetchLogGroupFields } from '../utils';

import syntax, {
  AGGREGATION_FUNCTIONS_STATS,
  BOOLEAN_FUNCTIONS,
  DATETIME_FUNCTIONS,
  FIELD_AND_FILTER_FUNCTIONS,
  IP_FUNCTIONS,
  NUMERIC_OPERATORS,
  QUERY_COMMANDS,
  STRING_FUNCTIONS,
} from './syntax';

export type CloudWatchHistoryItem = HistoryItem<CloudWatchQuery>;

type TypeaheadContext = {
  history?: CloudWatchHistoryItem[];
  absoluteRange?: AbsoluteTimeRange;
  logGroups?: LogGroup[];
  region: string;
};

export class CloudWatchLogsLanguageProvider extends LanguageProvider {
  started = false;
  declare initialRange: AbsoluteTimeRange;
  datasource: CloudWatchDatasource;
  templateSrv: TemplateSrv;

  constructor(datasource: CloudWatchDatasource, templateSrv?: TemplateSrv, initialValues?: any) {
    super();

    this.datasource = datasource;
    this.templateSrv = templateSrv ?? getTemplateSrv();

    Object.assign(this, initialValues);
  }

  // Strip syntax chars
  cleanText = (s: string) => s.replace(/[()]/g, '').trim();

  getSyntax(): Grammar {
    return syntax;
  }

  request = (url: string, params?: any): Promise<FetchResponse<BackendDataSourceResponse>> => {
    return lastValueFrom(this.datasource.logsQueryRunner.awsRequest(url, params));
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
    const grammar = this.getSyntax();
    const tokens = Prism.tokenize(query, grammar) ?? [];

    return !!tokens.find(
      (token) =>
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
      return await this.getFieldCompletionItems(context?.logGroups, context?.region || 'default');
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

  private handleKeyword = async (context?: TypeaheadContext): Promise<TypeaheadOutput> => {
    const suggs = await this.getFieldCompletionItems(context?.logGroups, context?.region || 'default');
    const functionSuggestions: CompletionItemGroup[] = [
      {
        searchFunctionType: SearchFunctionType.Prefix,
        label: 'Functions',
        items: STRING_FUNCTIONS.concat(DATETIME_FUNCTIONS, IP_FUNCTIONS),
      },
    ];
    suggs.suggestions.push(...functionSuggestions);

    return suggs;
  };

  private handleCommand = async (
    commandToken: Token,
    curToken: Token,
    context?: TypeaheadContext
  ): Promise<TypeaheadOutput> => {
    const queryCommand = commandToken.content.toLowerCase();
    const prevToken = prevNonWhitespaceToken(curToken);
    const currentTokenIsFirstArg = prevToken === commandToken;

    if (queryCommand === 'sort') {
      return this.handleSortCommand(currentTokenIsFirstArg, curToken, context);
    }

    if (queryCommand === 'parse') {
      if (currentTokenIsFirstArg) {
        return await this.getFieldCompletionItems(context?.logGroups ?? [], context?.region || 'default');
      }
    }

    const currentTokenIsAfterCommandAndEmpty = isTokenType(commandToken.next, 'whitespace') && !commandToken.next?.next;
    const currentTokenIsAfterCommand =
      currentTokenIsAfterCommandAndEmpty || nextNonWhitespaceToken(commandToken) === curToken;

    const currentTokenIsComma = isTokenType(curToken, 'punctuation', ',');
    const currentTokenIsCommaOrAfterComma = currentTokenIsComma || isTokenType(prevToken, 'punctuation', ',');

    // We only show suggestions if we are after a command or after a comma which is a field separator
    if (!(currentTokenIsAfterCommand || currentTokenIsCommaOrAfterComma)) {
      return { suggestions: [] };
    }

    if (['display', 'fields'].includes(queryCommand)) {
      const typeaheadOutput = await this.getFieldCompletionItems(
        context?.logGroups ?? [],
        context?.region || 'default'
      );
      typeaheadOutput.suggestions.push(...this.getFieldAndFilterFunctionCompletionItems().suggestions);

      return typeaheadOutput;
    }

    if (queryCommand === 'stats') {
      const typeaheadOutput = this.getStatsAggCompletionItems();
      if (currentTokenIsComma || currentTokenIsAfterCommandAndEmpty) {
        typeaheadOutput?.suggestions.forEach((group) => {
          group.skipFilter = true;
        });
      }
      return typeaheadOutput;
    }

    if (queryCommand === 'filter' && currentTokenIsFirstArg) {
      const sugg = await this.getFieldCompletionItems(context?.logGroups, context?.region || 'default');
      const boolFuncs = this.getBoolFuncCompletionItems();
      sugg.suggestions.push(...boolFuncs.suggestions);
      return sugg;
    }
    return { suggestions: [] };
  };

  private async handleSortCommand(
    isFirstArgument: boolean,
    curToken: Token,
    context?: TypeaheadContext
  ): Promise<TypeaheadOutput> {
    if (isFirstArgument) {
      return await this.getFieldCompletionItems(context?.logGroups, context?.region || 'default');
    } else if (isTokenType(prevNonWhitespaceToken(curToken), 'field-name')) {
      // suggest sort options
      return {
        suggestions: [
          {
            searchFunctionType: SearchFunctionType.Prefix,
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
    const fieldsSuggestions = await this.getFieldCompletionItems(context?.logGroups, context?.region || 'default');
    const comparisonSuggestions = this.getComparisonCompletionItems();
    fieldsSuggestions.suggestions.push(...comparisonSuggestions.suggestions);
    return fieldsSuggestions;
  };

  private getCommandCompletionItems = (): TypeaheadOutput => {
    return {
      suggestions: [{ searchFunctionType: SearchFunctionType.Prefix, label: 'Commands', items: QUERY_COMMANDS }],
    };
  };

  private getFieldAndFilterFunctionCompletionItems = (): TypeaheadOutput => {
    return {
      suggestions: [
        { searchFunctionType: SearchFunctionType.Prefix, label: 'Functions', items: FIELD_AND_FILTER_FUNCTIONS },
      ],
    };
  };

  private getStatsAggCompletionItems = (): TypeaheadOutput => {
    return {
      suggestions: [
        { searchFunctionType: SearchFunctionType.Prefix, label: 'Functions', items: AGGREGATION_FUNCTIONS_STATS },
      ],
    };
  };

  private getBoolFuncCompletionItems = (): TypeaheadOutput => {
    return {
      suggestions: [
        {
          searchFunctionType: SearchFunctionType.Prefix,
          label: 'Functions',
          items: BOOLEAN_FUNCTIONS,
        },
      ],
    };
  };

  private getComparisonCompletionItems = (): TypeaheadOutput => {
    return {
      suggestions: [
        {
          searchFunctionType: SearchFunctionType.Prefix,
          label: 'Functions',
          items: NUMERIC_OPERATORS.concat(BOOLEAN_FUNCTIONS),
        },
      ],
    };
  };

  private getFieldCompletionItems = async (
    logGroups: LogGroup[] | undefined,
    region: string
  ): Promise<TypeaheadOutput> => {
    if (!logGroups) {
      return { suggestions: [] };
    }

    const fields = await fetchLogGroupFields(logGroups, region, this.templateSrv, this.datasource.resources);
    return {
      suggestions: [
        {
          label: 'Fields',
          items: fields.map((field) => ({
            label: field,
            insertText: field.match(/@?[_a-zA-Z]+[_.0-9a-zA-Z]*/) ? undefined : `\`${field}\``,
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
    if (isTokenType(curToken.prev, 'whitespace')) {
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
      (!thisToken.prev || isTokenType(prevNonWhitespaceToken(thisToken), 'command-separator'))
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
].map((funcName) => funcName.toLowerCase());

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
  const maybeKeyword = getPreviousTokenExcluding(token, [
    'whitespace',
    'function',
    'punctuation',
    'field-name',
    'number',
  ]);
  if (isTokenType(maybeKeyword, 'keyword', 'by')) {
    const prev = getPreviousTokenExcluding(token, ['whitespace']);
    if (prev === maybeKeyword || isTokenType(prev, 'punctuation', ',')) {
      return true;
    }
  }
  return false;
}

function isTokenType(token: Token | undefined | null, type: string, content?: string): boolean {
  if (!token?.types.includes(type)) {
    return false;
  }
  if (content) {
    if (token?.content.toLowerCase() !== content) {
      return false;
    }
  }
  return true;
}

type TokenDef = string | { type: string; value: string };
function getPreviousTokenExcluding(token: Token, exclude: TokenDef[]): Token | undefined | null {
  let curToken = token.prev;
  main: while (curToken) {
    for (const item of exclude) {
      if (typeof item === 'string') {
        if (curToken.types.includes(item)) {
          curToken = curToken.prev;
          continue main;
        }
      } else {
        if (curToken.types.includes(item.type) && curToken.content.toLowerCase() === item.value) {
          curToken = curToken.prev;
          continue main;
        }
      }
    }
    break;
  }
  return curToken;
}
