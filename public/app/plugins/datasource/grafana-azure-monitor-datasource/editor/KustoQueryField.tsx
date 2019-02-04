import _ from 'lodash';
import Plain from 'slate-plain-serializer';

import QueryField from './query_field';
// import debounce from './utils/debounce';
// import {getNextCharacter} from './utils/dom';
import debounce from 'app/features/explore/utils/debounce';
import { getNextCharacter } from 'app/features/explore/utils/dom';

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

const defaultSchema = () => ({
  Databases: {
    Default: {}
  }
});

const cleanText = s => s.replace(/[{}[\]="(),!~+\-*/^%]/g, '').trim();
const wrapText = text => ({ text });

export default class KustoQueryField extends QueryField {
  fields: any;
  events: any;
  schema: KustoSchema;

  constructor(props, context) {
    super(props, context);
    this.schema = defaultSchema();

    this.onTypeahead = debounce(this.onTypeahead, TYPEAHEAD_DELAY);
  }

  componentDidMount() {
    super.componentDidMount();
    this.fetchSchema();
  }

  onTypeahead = () => {
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

      if (wrapperClasses.contains('function-context')) {
        typeaheadContext = 'context-function';
        if (this.fields) {
          suggestionGroups = this.getKeywordSuggestions();
        } else {
          this._fetchFields();
          return;
        }
      } else if (modelPrefix.match(/(where\s(\w+\b)?$)/i)) {
        typeaheadContext = 'context-where';
        const fullQuery = Plain.serialize(this.state.value);
        const table = this.getTableFromContext(fullQuery);
        if (table) {
          suggestionGroups = this.getWhereSuggestions(table);
        } else {
          return;
        }
      } else if (modelPrefix.match(/(,\s*$)/)) {
        typeaheadContext = 'context-multiple-fields';
        if (this.fields) {
          suggestionGroups = this.getKeywordSuggestions();
        } else {
          this._fetchFields();
          return;
        }
      } else if (modelPrefix.match(/(from\s$)/i)) {
        typeaheadContext = 'context-from';
        if (this.events) {
          suggestionGroups = this.getKeywordSuggestions();
        } else {
          this._fetchEvents();
          return;
        }
      } else if (modelPrefix.match(/(^select\s\w*$)/i)) {
        typeaheadContext = 'context-select';
        if (this.fields) {
          suggestionGroups = this.getKeywordSuggestions();
        } else {
          this._fetchFields();
          return;
        }
      } else if (modelPrefix.match(/from\s\S+\s\w*$/i)) {
        prefix = '';
        typeaheadContext = 'context-since';
        suggestionGroups = this.getKeywordSuggestions();
      // } else if (modelPrefix.match(/\d+\s\w*$/)) {
      //   typeaheadContext = 'context-number';
      //   suggestionGroups = this._getAfterNumberSuggestions();
      } else if (modelPrefix.match(/ago\b/i) || modelPrefix.match(/facet\b/i) || modelPrefix.match(/\$__timefilter\b/i)) {
        typeaheadContext = 'context-timeseries';
        suggestionGroups = this.getKeywordSuggestions();
      } else if (prefix && !wrapperClasses.contains('argument')) {
        if (modelPrefix.match(/\s$/i)) {
          prefix = '';
        }
        typeaheadContext = 'context-builtin';
        suggestionGroups = this.getKeywordSuggestions();
      } else if (Plain.serialize(this.state.value) === '') {
        typeaheadContext = 'context-new';
        if (this.schema) {
          suggestionGroups = this._getInitialSuggestions();
        } else {
          this.fetchSchema();
          setTimeout(this.onTypeahead, 0);
          return;
        }
      } else {
        typeaheadContext = 'context-builtin';
        if (modelPrefix.match(/\s$/i)) {
          prefix = '';
        }
        suggestionGroups = this.getKeywordSuggestions();
      }

      let results = 0;
      prefix = prefix.toLowerCase();
      const filteredSuggestions = suggestionGroups.map(group => {
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
      // console.log('onTypeahead', modelPrefix, prefix, typeaheadContext);

      this.setState({
        typeaheadPrefix: prefix,
        typeaheadContext,
        typeaheadText: text,
        suggestions: results > 0 ? filteredSuggestions : [],
      });
    }
  }

  applyTypeahead(change, suggestion) {
    const { typeaheadPrefix, typeaheadContext, typeaheadText } = this.state;
    let suggestionText = suggestion.text || suggestion;
    const move = 0;

    // Modify suggestion based on context

    const nextChar = getNextCharacter();
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

    this.resetTypeahead();

    // Remove the current, incomplete text and replace it with the selected suggestion
    const backward = suggestion.deleteBackwards || typeaheadPrefix.length;
    const text = cleanText(typeaheadText);
    const suffixLength = text.length - typeaheadPrefix.length;
    const offset = typeaheadText.indexOf(typeaheadPrefix);
    const midWord = typeaheadPrefix && ((suffixLength > 0 && offset > -1) || suggestionText === typeaheadText);
    const forward = midWord ? suffixLength + offset : 0;

    return change
      .deleteBackward(backward)
      .deleteForward(forward)
      .insertText(suggestionText)
      .move(move)
      .focus();
  }

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

  private getKeywordSuggestions(): SuggestionGroup[] {
    return [
      {
        prefixMatch: true,
        label: 'Keywords',
        items: KEYWORDS.map(wrapText)
      },
      {
        prefixMatch: true,
        label: 'Operators',
        items: operatorTokens
      },
      {
        prefixMatch: true,
        label: 'Functions',
        items: functionTokens.map((s: any) => { s.type = 'function'; return s; })
      },
      {
        prefixMatch: true,
        label: 'Macros',
        items: grafanaMacros.map((s: any) => { s.type = 'function'; return s; })
      },
      {
        prefixMatch: true,
        label: 'Tables',
        items: _.map(this.schema.Databases.Default.Tables, (t: any) => ({ text: t.Name }))
      }
    ];
  }

  private _getInitialSuggestions(): SuggestionGroup[] {
    return [
      {
        prefixMatch: true,
        label: 'Tables',
        items: _.map(this.schema.Databases.Default.Tables, (t: any) => ({ text: t.Name }))
      }
    ];

    // return [
    //   {
    //     prefixMatch: true,
    //     label: 'Keywords',
    //     items: KEYWORDS.map(wrapText)
    //   },
    //   {
    //     prefixMatch: true,
    //     label: 'Operators',
    //     items: operatorTokens.map((s: any) => { s.type = 'function'; return s; })
    //   },
    //   {
    //     prefixMatch: true,
    //     label: 'Functions',
    //     items: functionTokens.map((s: any) => { s.type = 'function'; return s; })
    //   },
    //   {
    //     prefixMatch: true,
    //     label: 'Macros',
    //     items: grafanaMacros.map((s: any) => { s.type = 'function'; return s; })
    //   }
    // ];
  }

  private getWhereSuggestions(table: string): SuggestionGroup[] {
    const tableSchema = this.schema.Databases.Default.Tables[table];
    if (tableSchema) {
      return [
        {
          prefixMatch: true,
          label: 'Fields',
          items: _.map(tableSchema.OrderedColumns, (f: any) => ({
            text: f.Name,
            hint: f.Type
          }))
        }
      ];
    } else {
      return [];
    }
  }

  private getTableFromContext(query: string) {
    const tablePattern = /^\s*(\w+)\s*|/g;
    const normalizedQuery = normalizeQuery(query);
    const match = tablePattern.exec(normalizedQuery);
    if (match && match.length > 1 && match[0] && match[1]) {
      return match[1];
    } else {
      return null;
    }
  }

  private async _fetchEvents() {
    // const query = 'events';
    // const result = await this.request(query);

    // if (result === undefined) {
    //   this.events = [];
    // } else {
    //   this.events = result;
    // }
    // setTimeout(this.onTypeahead, 0);

    //Stub
    this.events = [];
  }

  private async _fetchFields() {
    // const query = 'fields';
    // const result = await this.request(query);

    // this.fields = result || [];

    // setTimeout(this.onTypeahead, 0);
    // Stub
    this.fields = [];
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
function castSchema(schema) {
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
