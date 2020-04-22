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
import { dateTime, AbsoluteTimeRange, LanguageProvider, HistoryItem } from '@grafana/data';

import { CloudWatchDatasource } from './datasource';
import { CompletionItem, TypeaheadInput, TypeaheadOutput, Token } from '@grafana/ui';
import { Grammar } from 'prismjs';

const HISTORY_ITEM_COUNT = 10;
const HISTORY_COUNT_CUTOFF = 1000 * 60 * 60 * 24; // 24h
const NS_IN_MS = 1000000;
export const LABEL_REFRESH_INTERVAL = 1000 * 30; // 30sec

const wrapLabel = (label: string) => ({ label });
export const rangeToParams = (range: AbsoluteTimeRange) => ({ start: range.from * NS_IN_MS, end: range.to * NS_IN_MS });

export type CloudWatchHistoryItem = HistoryItem<CloudWatchQuery>;

type TypeaheadContext = {
  history?: CloudWatchHistoryItem[];
  absoluteRange?: AbsoluteTimeRange;
  logGroupNames?: string[];
};

export function addHistoryMetadata(item: CompletionItem, history: CloudWatchHistoryItem[]): CompletionItem {
  const cutoffTs = Date.now() - HISTORY_COUNT_CUTOFF;
  const historyForItem = history.filter(h => h.ts > cutoffTs && h.query.expression === item.label);
  let hint = `Queried ${historyForItem.length} times in the last 24h.`;
  const recent = historyForItem[0];

  if (recent) {
    const lastQueried = dateTime(recent.ts).fromNow();
    hint = `${hint} Last queried ${lastQueried}.`;
  }

  return {
    ...item,
    documentation: hint,
  };
}

export class CloudWatchLanguageProvider extends LanguageProvider {
  logLabelOptions: any[];
  logLabelFetchTs?: number;
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
      logGroups.map(logGroup => {
        return this.datasource.getLogGroupFields({ logGroupName: logGroup });
      })
    );

    return [
      ...new Set<string>(
        results.reduce((acc: string[], cur) => acc.concat(cur.logGroupFields.map(f => f.name)), [])
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
    //console.log('Providing completion items...');
    const { value } = input;

    // Get tokens
    const tokens = value.data.get('tokens');

    if (!tokens || !tokens.length) {
      return { suggestions: [] };
    }

    const curToken: Token = tokens.filter(
      (toke: any) =>
        toke.offsets.start <= value.selection.start.offset && toke.offsets.end >= value.selection.start.offset
    )[0];
    const isFirstToken = curToken.prev === null || curToken.prev === undefined;
    const prevToken = prevNonWhitespaceToken(curToken);
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

    if (curToken.content === '(' && prevToken != null) {
      if (funcsWithFieldArgs.includes(prevToken.content.toLowerCase()) && prevToken.types.includes('function')) {
        const suggs = await this.getFieldCompletionItems(context.logGroupNames);
        return suggs;
      }
    }

    // if (prevToken === null) {
    //   return {
    //     suggestions: [],
    //   };
    // }

    // if (prevToken) {
    //   console.log(`Previous token: '${prevToken.content}'`);
    // }

    const isCommandStart = isFirstToken || (!isFirstToken && prevToken.types.includes('command-separator'));
    //console.log(`Is command start? ${isCommandStart}`);
    if (isCommandStart) {
      return this.getCommandCompletionItems();
    } else if (!isFirstToken) {
      if (prevToken.types.includes('keyword')) {
        return this.handleKeyword(prevToken, context);
      }

      if (prevToken.types.includes('comparison-operator')) {
        const suggs = await this.getFieldCompletionItems(context.logGroupNames);
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

  handleKeyword = async (token: Token, context: TypeaheadContext): Promise<TypeaheadOutput | null> => {
    if (token.content.toLowerCase() === 'by') {
      const suggs = await this.getFieldCompletionItems(context.logGroupNames);
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

    // console.log(
    //   `Query Command: '${queryCommand}'. Previous token: '${prevToken}'. First arg? ${currentTokenIsFirstArg}`
    // );

    if (queryCommand === 'sort') {
      if (currentTokenIsFirstArg) {
        return await this.getFieldCompletionItems(context.logGroupNames);
      } else if (prevToken.types.includes('field-name')) {
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
        return await this.getFieldCompletionItems(context.logGroupNames);
      }
    }

    let typeaheadOutput: TypeaheadOutput;
    if (
      (commandToken.next.types.includes('whitespace') && commandToken.next.next === null) ||
      nextNonWhitespaceToken(commandToken) === curToken ||
      (curToken.content === ',' && curToken.types.includes('punctuation')) ||
      (curToken.prev.content === ',' && curToken.prev.types.includes('punctuation'))
    ) {
      if (['display', 'fields'].includes(queryCommand)) {
        // Current token comes straight after command OR after comma
        typeaheadOutput = await this.getFieldCompletionItems(context.logGroupNames);
        typeaheadOutput.suggestions.push(...this.getFunctionCompletionItems().suggestions);

        return typeaheadOutput;
      } else if (queryCommand === 'stats') {
        typeaheadOutput = this.getStatsAggCompletionItems();
      } else if (queryCommand === 'filter') {
        if (currentTokenIsFirstArg) {
          const sugg = await this.getFieldCompletionItems(context.logGroupNames);
          const boolFuncs = this.getBoolFuncCompletionItems();
          sugg.suggestions.push(...boolFuncs.suggestions);
          return sugg;
        }
      }

      if (
        (curToken.content === ',' && curToken.types.includes('punctuation')) ||
        (commandToken.next.types.includes('whitespace') && commandToken.next.next === null)
      ) {
        typeaheadOutput.suggestions.forEach(group => {
          group.skipFilter = true;
        });
      }

      return typeaheadOutput;
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
        if (!isFirstCommand && thisToken.next.types.includes('query-command')) {
          return thisToken.next;
        } else {
          return thisToken;
        }
      }
    }

    return null;
  };

  getBeginningCompletionItems = (context: TypeaheadContext): TypeaheadOutput => {
    return {
      suggestions: [
        ...this.getEmptyCompletionItems(context).suggestions,
        ...this.getCommandCompletionItems().suggestions,
      ],
    };
  };

  getEmptyCompletionItems(context: TypeaheadContext): TypeaheadOutput {
    const history = context?.history;
    const suggestions = [];

    if (history?.length) {
      const historyItems = _.chain(history)
        .map(h => h.query.expression)
        .filter()
        .uniq()
        .take(HISTORY_ITEM_COUNT)
        .map(wrapLabel)
        .map((item: CompletionItem) => addHistoryMetadata(item, history))
        .value();

      suggestions.push({
        prefixMatch: true,
        skipSort: true,
        label: 'History',
        items: historyItems,
      });
    }

    return { suggestions };
  }

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
    //console.log(`Fetching fields... ${logGroups}`);
    const fields = await this.fetchFields(logGroups);

    //console.log(fields);
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
