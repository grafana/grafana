import Plain from 'slate-plain-serializer';

import QueryField from './query_field';
// import debounce from './utils/debounce';
// import {getNextCharacter} from './utils/dom';
import debounce from 'app/features/explore/utils/debounce';
import { getNextCharacter } from 'app/features/explore/utils/dom';

import { FUNCTIONS, KEYWORDS } from './kusto';
// import '../sass/editor.base.scss';


const TYPEAHEAD_DELAY = 500;

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

const cleanText = s => s.replace(/[{}[\]="(),!~+\-*/^%]/g, '').trim();
const wrapText = text => ({ text });

export default class KustoQueryField extends QueryField {
  fields: any;
  events: any;

  constructor(props, context) {
    super(props, context);

    this.onTypeahead = debounce(this.onTypeahead, TYPEAHEAD_DELAY);
  }

  componentDidMount() {
    this.updateMenu();
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
          suggestionGroups = this._getKeywordSuggestions();
        } else {
          this._fetchFields();
          return;
        }
      } else if (modelPrefix.match(/(facet\s$)/i)) {
        typeaheadContext = 'context-facet';
        if (this.fields) {
          suggestionGroups = this._getKeywordSuggestions();
        } else {
          this._fetchFields();
          return;
        }
      } else if (modelPrefix.match(/(,\s*$)/)) {
        typeaheadContext = 'context-multiple-fields';
        if (this.fields) {
          suggestionGroups = this._getKeywordSuggestions();
        } else {
          this._fetchFields();
          return;
        }
      } else if (modelPrefix.match(/(from\s$)/i)) {
        typeaheadContext = 'context-from';
        if (this.events) {
          suggestionGroups = this._getKeywordSuggestions();
        } else {
          this._fetchEvents();
          return;
        }
      } else if (modelPrefix.match(/(^select\s\w*$)/i)) {
        typeaheadContext = 'context-select';
        if (this.fields) {
          suggestionGroups = this._getKeywordSuggestions();
        } else {
          this._fetchFields();
          return;
        }
      } else if (modelPrefix.match(/from\s\S+\s\w*$/i)) {
        prefix = '';
        typeaheadContext = 'context-since';
        suggestionGroups = this._getKeywordSuggestions();
      // } else if (modelPrefix.match(/\d+\s\w*$/)) {
      //   typeaheadContext = 'context-number';
      //   suggestionGroups = this._getAfterNumberSuggestions();
      } else if (modelPrefix.match(/ago\b/i) || modelPrefix.match(/facet\b/i) || modelPrefix.match(/\$__timefilter\b/i)) {
        typeaheadContext = 'context-timeseries';
        suggestionGroups = this._getKeywordSuggestions();
      } else if (prefix && !wrapperClasses.contains('argument')) {
        typeaheadContext = 'context-builtin';
        suggestionGroups = this._getKeywordSuggestions();
      } else if (Plain.serialize(this.state.value) === '') {
        typeaheadContext = 'context-new';
        suggestionGroups = this._getInitialSuggestions();
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

  private _getKeywordSuggestions(): SuggestionGroup[] {
    return [
      {
        prefixMatch: true,
        label: 'Keywords',
        items: KEYWORDS.map(wrapText)
      },
      {
        prefixMatch: true,
        label: 'Functions',
        items: FUNCTIONS.map((s: any) => { s.type = 'function'; return s; })
      }
    ];
  }

  private _getInitialSuggestions(): SuggestionGroup[] {
    // TODO: return datbase tables as an initial suggestion
    return [
      {
        prefixMatch: true,
        label: 'Keywords',
        items: KEYWORDS.map(wrapText)
      },
      {
        prefixMatch: true,
        label: 'Functions',
        items: FUNCTIONS.map((s: any) => { s.type = 'function'; return s; })
      }
    ];
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
}
