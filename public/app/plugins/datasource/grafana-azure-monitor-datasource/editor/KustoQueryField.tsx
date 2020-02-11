import _ from 'lodash';
import Plain from 'slate-plain-serializer';

import QueryField from './query_field';
import debounce from 'lodash/debounce';
import { DOMUtil } from '@grafana/ui';
import { Editor as CoreEditor } from 'slate';

import { KEYWORDS, functionTokens, operatorTokens, grafanaMacros } from './kusto/kusto';
// import '../sass/editor.base.scss';

const TYPEAHEAD_DELAY = 100;

interface Suggestion {
  text: string;
  deleteBackwards?: number;
  type?: string;
}

interface SuggestionGroup {
  label: string;
  items: Suggestion[];
  prefixMatch?: boolean;
  skipFilter?: boolean;
}

interface KustoSchema {
  Databases: {
    Default?: KustoDBSchema;
  };
  Plugins?: any[];
}

interface KustoDBSchema {
  Name?: string;
  Functions?: any;
  Tables?: any;
}

const defaultSchema: any = () => ({
  Databases: {
    Default: {},
  },
});

const cleanText = (s: string) => s.replace(/[{}[\]="(),!~+\-*/^%]/g, '').trim();
const wrapText = (text: string) => ({ text });

export default class KustoQueryField extends QueryField {
  fields: any;
  events: any;
  schema: KustoSchema;

  constructor(props: any, context: any) {
    super(props, context);
    this.schema = defaultSchema();

    this.onTypeahead = debounce(this.onTypeahead, TYPEAHEAD_DELAY);
  }

  componentDidMount() {
    super.componentDidMount();
    this.fetchSchema();
  }

  onTypeahead = (force = false) => {
    const selection = window.getSelection();
    if (selection.anchorNode) {
      const wrapperNode = selection.anchorNode.parentElement;
      if (wrapperNode === null) {
        return;
      }
      const editorNode = wrapperNode.closest('.slate-query-field');
      if (!editorNode || this.state.value.isBlurred) {
        // Not inside this editor
        return;
      }

      // DOM ranges
      const range = selection.getRangeAt(0);
      const text = selection.anchorNode.textContent;
      if (text === null) {
        return;
      }
      const offset = range.startOffset;
      let prefix = cleanText(text.substr(0, offset));

      // Model ranges
      const modelOffset = this.state.value.anchorOffset;
      const modelPrefix = this.state.value.anchorText.text.slice(0, modelOffset);

      // Determine candidates by context
      let suggestionGroups: SuggestionGroup[] = [];
      const wrapperClasses = wrapperNode.classList;
      let typeaheadContext: string | null = null;

      // Built-in functions
      if (wrapperClasses.contains('function-context')) {
        typeaheadContext = 'context-function';
        suggestionGroups = this.getColumnSuggestions();

        // where
      } else if (modelPrefix.match(/(where\s(\w+\b)?$)/i)) {
        typeaheadContext = 'context-where';
        suggestionGroups = this.getColumnSuggestions();

        // summarize by
      } else if (modelPrefix.match(/(summarize\s(\w+\b)?$)/i)) {
        typeaheadContext = 'context-summarize';
        suggestionGroups = this.getFunctionSuggestions();
      } else if (modelPrefix.match(/(summarize\s(.+\s)?by\s+([^,\s]+,\s*)*([^,\s]+\b)?$)/i)) {
        typeaheadContext = 'context-summarize-by';
        suggestionGroups = this.getColumnSuggestions();

        // order by, top X by, ... by ...
      } else if (modelPrefix.match(/(by\s+([^,\s]+,\s*)*([^,\s]+\b)?$)/i)) {
        typeaheadContext = 'context-by';
        suggestionGroups = this.getColumnSuggestions();

        // join
      } else if (modelPrefix.match(/(on\s(.+\b)?$)/i)) {
        typeaheadContext = 'context-join-on';
        suggestionGroups = this.getColumnSuggestions();
      } else if (modelPrefix.match(/(join\s+(\(\s+)?(\w+\b)?$)/i)) {
        typeaheadContext = 'context-join';
        suggestionGroups = this.getTableSuggestions();

        // distinct
      } else if (modelPrefix.match(/(distinct\s(.+\b)?$)/i)) {
        typeaheadContext = 'context-distinct';
        suggestionGroups = this.getColumnSuggestions();

        // database()
      } else if (modelPrefix.match(/(database\(\"(\w+)\"\)\.(.+\b)?$)/i)) {
        typeaheadContext = 'context-database-table';
        const db = this.getDBFromDatabaseFunction(modelPrefix);
        console.log(db);
        suggestionGroups = this.getTableSuggestions(db);
        prefix = prefix.replace('.', '');

        // new
      } else if (normalizeQuery(Plain.serialize(this.state.value)).match(/^\s*\w*$/i)) {
        typeaheadContext = 'context-new';
        if (this.schema) {
          suggestionGroups = this.getInitialSuggestions();
        } else {
          this.fetchSchema();
          setTimeout(this.onTypeahead, 0);
          return;
        }

        // built-in
      } else if (prefix && !wrapperClasses.contains('argument') && !force) {
        // Use only last typed word as a prefix for searching
        if (modelPrefix.match(/\s$/i)) {
          prefix = '';
          return;
        }
        prefix = getLastWord(prefix);
        typeaheadContext = 'context-builtin';
        suggestionGroups = this.getKeywordSuggestions();
      } else if (force === true) {
        typeaheadContext = 'context-builtin-forced';
        if (modelPrefix.match(/\s$/i)) {
          prefix = '';
        }
        suggestionGroups = this.getKeywordSuggestions();
      }

      let results = 0;
      prefix = prefix.toLowerCase();
      const filteredSuggestions = suggestionGroups
        .map(group => {
          if (group.items && prefix && !group.skipFilter) {
            group.items = group.items.filter(c => c.text.length >= prefix.length);
            if (group.prefixMatch) {
              group.items = group.items.filter(c => c.text.toLowerCase().indexOf(prefix) === 0);
            } else {
              group.items = group.items.filter(c => c.text.toLowerCase().indexOf(prefix) > -1);
            }
          }
          results += group.items.length;
          return group;
        })
        .filter(group => group.items.length > 0);

      // console.log('onTypeahead', selection.anchorNode, wrapperClasses, text, offset, prefix, typeaheadContext);
      // console.log('onTypeahead', prefix, typeaheadContext, force);

      this.setState({
        typeaheadPrefix: prefix,
        typeaheadContext,
        typeaheadText: text,
        suggestions: results > 0 ? filteredSuggestions : [],
      });
    }
  };

  applyTypeahead = (editor: CoreEditor, suggestion: { text: any; type: string; deleteBackwards: any }): CoreEditor => {
    const { typeaheadPrefix, typeaheadContext, typeaheadText } = this.state;
    let suggestionText = suggestion.text || suggestion;
    const move = 0;

    // Modify suggestion based on context

    const nextChar = DOMUtil.getNextCharacter();
    if (suggestion.type === 'function') {
      if (!nextChar || nextChar !== '(') {
        suggestionText += '(';
      }
    } else if (typeaheadContext === 'context-function') {
      if (!nextChar || nextChar !== ')') {
        suggestionText += ')';
      }
    } else {
      if (!nextChar || nextChar !== ' ') {
        suggestionText += ' ';
      }
    }

    // Remove the current, incomplete text and replace it with the selected suggestion
    const backward = suggestion.deleteBackwards || typeaheadPrefix.length;
    const text = cleanText(typeaheadText);
    const suffixLength = text.length - typeaheadPrefix.length;
    const offset = typeaheadText.indexOf(typeaheadPrefix);
    const midWord = typeaheadPrefix && ((suffixLength > 0 && offset > -1) || suggestionText === typeaheadText);
    const forward = midWord ? suffixLength + offset : 0;

    this.resetTypeahead(() =>
      editor
        .deleteBackward(backward)
        .deleteForward(forward)
        .insertText(suggestionText)
        .moveForward(move)
        .focus()
    );

    return editor;
  };

  // private _getFieldsSuggestions(): SuggestionGroup[] {
  //   return [
  //     {
  //       prefixMatch: true,
  //       label: 'Fields',
  //       items: this.fields.map(wrapText)
  //     },
  //     {
  //       prefixMatch: true,
  //       label: 'Variables',
  //       items: this.props.templateVariables.map(wrapText)
  //     }
  //   ];
  // }

  // private _getAfterFromSuggestions(): SuggestionGroup[] {
  //   return [
  //     {
  //       skipFilter: true,
  //       label: 'Events',
  //       items: this.events.map(wrapText)
  //     },
  //     {
  //       prefixMatch: true,
  //       label: 'Variables',
  //       items: this.props.templateVariables
  //         .map(wrapText)
  //         .map(suggestion => {
  //           suggestion.deleteBackwards = 0;
  //           return suggestion;
  //         })
  //     }
  //   ];
  // }

  // private _getAfterSelectSuggestions(): SuggestionGroup[] {
  //   return [
  //     {
  //       prefixMatch: true,
  //       label: 'Fields',
  //       items: this.fields.map(wrapText)
  //     },
  //     {
  //       prefixMatch: true,
  //       label: 'Functions',
  //       items: FUNCTIONS.map((s: any) => { s.type = 'function'; return s; })
  //     },
  //     {
  //       prefixMatch: true,
  //       label: 'Variables',
  //       items: this.props.templateVariables.map(wrapText)
  //     }
  //   ];
  // }

  private getInitialSuggestions(): SuggestionGroup[] {
    return this.getTableSuggestions();
  }

  private getKeywordSuggestions(): SuggestionGroup[] {
    return [
      {
        prefixMatch: true,
        label: 'Keywords',
        items: KEYWORDS.map(wrapText),
      },
      {
        prefixMatch: true,
        label: 'Operators',
        items: operatorTokens,
      },
      {
        prefixMatch: true,
        label: 'Functions',
        items: functionTokens.map((s: any) => {
          s.type = 'function';
          return s;
        }),
      },
      {
        prefixMatch: true,
        label: 'Macros',
        items: grafanaMacros.map((s: any) => {
          s.type = 'function';
          return s;
        }),
      },
      {
        prefixMatch: true,
        label: 'Tables',
        items: _.map(this.schema.Databases.Default.Tables, (t: any) => ({ text: t.Name })),
      },
    ];
  }

  private getFunctionSuggestions(): SuggestionGroup[] {
    return [
      {
        prefixMatch: true,
        label: 'Functions',
        items: functionTokens.map((s: any) => {
          s.type = 'function';
          return s;
        }),
      },
      {
        prefixMatch: true,
        label: 'Macros',
        items: grafanaMacros.map((s: any) => {
          s.type = 'function';
          return s;
        }),
      },
    ];
  }

  getTableSuggestions(db = 'Default'): SuggestionGroup[] {
    // @ts-ignore
    if (this.schema.Databases[db]) {
      return [
        {
          prefixMatch: true,
          label: 'Tables',
          // @ts-ignore
          items: _.map(this.schema.Databases[db].Tables, (t: any) => ({ text: t.Name })),
        },
      ];
    } else {
      return [];
    }
  }

  private getColumnSuggestions(): SuggestionGroup[] {
    const table = this.getTableFromContext();
    if (table) {
      const tableSchema = this.schema.Databases.Default.Tables[table];
      if (tableSchema) {
        return [
          {
            prefixMatch: true,
            label: 'Fields',
            items: _.map(tableSchema.OrderedColumns, (f: any) => ({
              text: f.Name,
              hint: f.Type,
            })),
          },
        ];
      }
    }
    return [];
  }

  private getTableFromContext() {
    const query = Plain.serialize(this.state.value);
    const tablePattern = /^\s*(\w+)\s*|/g;
    const normalizedQuery = normalizeQuery(query);
    const match = tablePattern.exec(normalizedQuery);
    if (match && match.length > 1 && match[0] && match[1]) {
      return match[1];
    } else {
      return null;
    }
  }

  private getDBFromDatabaseFunction(prefix: string) {
    const databasePattern = /database\(\"(\w+)\"\)/gi;
    const match = databasePattern.exec(prefix);
    if (match && match.length > 1 && match[0] && match[1]) {
      return match[1];
    } else {
      return null;
    }
  }

  private async fetchSchema() {
    let schema = await this.props.getSchema();
    if (schema) {
      if (schema.Type === 'AppInsights') {
        schema = castSchema(schema);
      }
      this.schema = schema;
    } else {
      this.schema = defaultSchema();
    }
  }
}

/**
 * Cast schema from App Insights to default Kusto schema
 */
function castSchema(schema: any) {
  const defaultSchemaTemplate = defaultSchema();
  defaultSchemaTemplate.Databases.Default = schema;
  return defaultSchemaTemplate;
}

function normalizeQuery(query: string): string {
  const commentPattern = /\/\/.*$/gm;
  let normalizedQuery = query.replace(commentPattern, '');
  normalizedQuery = normalizedQuery.replace('\n', ' ');
  return normalizedQuery;
}

function getLastWord(str: string): string {
  const lastWordPattern = /(?:.*\s)?([^\s]+\s*)$/gi;
  const match = lastWordPattern.exec(str);
  if (match && match.length > 1) {
    return match[1];
  }
  return '';
}
