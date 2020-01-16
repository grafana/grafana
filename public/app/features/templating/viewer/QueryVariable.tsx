import React, { MouseEvent, PureComponent } from 'react';
import map from 'lodash/map';
import debounce from 'lodash/debounce';
import { e2e } from '@grafana/e2e';

import { containsSearchFilter, QueryVariableModel, VariableHide, VariableOption, VariableTag } from '../variable';

export interface Props {
  variable: QueryVariableModel;
}

export interface State {
  showDropDown: boolean;
  linkText: string | string[];
  selectedValues: VariableOption[];
  selectedTags: VariableTag[];
  searchQuery: string;
  searchOptions: VariableOption[];
  highlightIndex: number;
  tags: VariableTag[];
  queryHasSearchFilter: boolean;
}

export class QueryVariable extends PureComponent<Props, State> {
  private readonly debouncedOnQueryChanged: Function;
  constructor(props: Props) {
    super(props);
    const queryHasSearchFilter = props.variable ? containsSearchFilter(props.variable.query) : false;
    const selectedTags = props.variable?.current.tags || [];

    this.state = {
      showDropDown: false,
      linkText: '',
      selectedValues: [],
      searchQuery: '',
      searchOptions: [],
      highlightIndex: -1,
      tags: [],
      queryHasSearchFilter,
      selectedTags,
    };
    this.debouncedOnQueryChanged = debounce((searchQuery: string) => {
      this.onQueryChanged(searchQuery);
    }, 200);
  }

  componentDidMount(): void {
    this.updateLinkText();
  }

  onShowDropDown = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const { variable } = this.props;
    // this.oldVariableText = this.variable.current.text;
    // this.highlightIndex = -1;

    // this.options = this.variable.options;
    // this.selectedValues = filter(this.options, { selected: true });
    //
    // this.tags = map(this.variable.tags, value => {
    //   let tag = { text: value, selected: false };
    //   each(this.variable.current.tags, tagObj => {
    //     if (tagObj.text === value) {
    //       tag = tagObj;
    //     }
    //   });
    //   return tag;
    // });
    const tags = variable.tags
      ? variable.tags.map(tag => {
          const currentTag = variable.current.tags.filter(t => t.text === tag.text)[0];
          return currentTag || { text: tag.text, selected: false };
        })
      : [];

    // new behaviour, if this is a query that uses searchfilter it might be a nicer
    // user experience to show the last typed search query in the input field
    const searchQuery = this.state.queryHasSearchFilter && this.state.searchQuery ? this.state.searchQuery : '';

    // this.search = {
    //   query,
    //   options: this.options.slice(0, Math.min(this.options.length, 1000)),
    // };

    // this.dropdownVisible = true;
    this.setState({
      showDropDown: true,
      highlightIndex: -1,
      selectedValues: variable.options.filter(option => option.selected),
      tags,
      searchQuery,
      searchOptions: variable.options.slice(0, Math.min(variable.options.length, 1000)),
    });
  };

  updateLinkText = () => {
    const { variable } = this.props;
    const current = variable.current;

    if (!current.tags || current.tags.length === 0) {
      this.setState({ linkText: variable.current.text });
      return;
    }

    // filer out values that are in selected tags
    const selectedAndNotInTag = variable.options.filter(option => {
      if (!option.selected) {
        return false;
      }
      for (let i = 0; i < current.tags.length; i++) {
        const tag = current.tags[i];
        if (tag.values.findIndex(value => value === option.value) !== -1) {
          return false;
        }
      }
      return true;
    });

    // convert values to text
    const currentTexts = map(selectedAndNotInTag, 'text');

    // join texts
    let linkText = currentTexts.join(' + ');
    if (linkText.length > 0) {
      linkText += ' + ';
    }
    this.setState({ linkText });
  };

  onQueryChanged = (searchQuery: string) => {
    const { variable } = this.props;
    const { queryHasSearchFilter } = this.state;
    if (queryHasSearchFilter) {
      // dispatch call to thunk instead
      // await this.updateLazyLoadedOptions();
      return;
    }

    this.setState({
      searchQuery,
      searchOptions: variable.options.filter(option => {
        const text = Array.isArray(option.text) ? option.text[0] : option.text;
        return text.toLowerCase().indexOf(searchQuery.toLowerCase()) !== -1;
      }),
    });
  };

  render() {
    const { variable } = this.props;
    const {
      linkText,
      selectedTags,
      searchQuery,
      showDropDown,
      selectedValues,
      searchOptions,
      highlightIndex,
      tags,
    } = this.state;

    if (!variable) {
      return <div>Could not load variable</div>;
    }

    const label = variable.label || variable.name;
    return (
      <div className="gf-form">
        {variable.hide !== VariableHide.hideLabel && (
          <label
            className="gf-form-label template-variable"
            aria-label={e2e.pages.Dashboard.SubMenu.selectors.submenuItemLabels(label)}
          >
            {label}
          </label>
        )}
        {variable.hide !== VariableHide.hideVariable && (
          <div className="variable-link-wrapper">
            {!showDropDown && (
              <a
                onClick={this.onShowDropDown}
                className="variable-value-link"
                aria-label={e2e.pages.Dashboard.SubMenu.selectors.submenuItemValueDropDownValueLinkTexts(`${linkText}`)}
              >
                {linkText}
                {selectedTags.map(tag => {
                  return (
                    <span bs-tooltip="tag.valuesText" data-placement="bottom" key={`${tag.text}`}>
                      {/*<span className="label-tag" tag-color-from-name="tag.text">*/}
                      <span className="label-tag">
                        &nbsp;&nbsp;<i className="fa fa-tag"></i>&nbsp; {tag.text}
                      </span>
                    </span>
                  );
                })}
                <i className="fa fa-caret-down" style={{ fontSize: '12px' }}></i>
              </a>
            )}

            {showDropDown && (
              <input
                type="text"
                className="gf-form-input"
                value={searchQuery}
                onChange={event => this.debouncedOnQueryChanged(event.target.value)}
                autoFocus={true}
                // ng-keydown="vm.keyDown($event)"
                // ng-model="vm.search.query"
                // ng-change="vm.debouncedQueryChanged()"
              />
            )}

            {showDropDown && (
              <div
                className={`${variable.multi ? 'variable-value-dropdown multi' : 'variable-value-dropdown single'}`}
                aria-label={e2e.pages.Dashboard.SubMenu.selectors.submenuItemValueDropDownDropDown}
              >
                <div className="variable-options-wrapper">
                  <div className="variable-options-column">
                    {variable.multi && (
                      <a
                        className={`${
                          selectedValues.length > 1
                            ? 'variable-options-column-header many-selected'
                            : 'variable-options-column-header'
                        }`}
                        // bs-tooltip="'Clear selections'"
                        data-placement="top"
                        // ng-click="vm.clearSelections()"
                      >
                        <span className="variable-option-icon"></span>
                        Selected ({selectedValues.length})
                      </a>
                    )}
                    {searchOptions.map((option, index) => {
                      const selectClass = option.selected
                        ? 'variable-option pointer selected'
                        : 'variable-option pointer';
                      const highlightClass = index === highlightIndex ? `${selectClass} highlighted` : selectClass;
                      return (
                        <a
                          key={`${option.value}`}
                          className={highlightClass}
                          // ng-click="vm.selectValue(option, $event)"
                        >
                          <span className="variable-option-icon"></span>
                          <span
                            aria-label={e2e.pages.Dashboard.SubMenu.selectors.submenuItemValueDropDownOptionTexts(
                              `${option.text}`
                            )}
                          >
                            {option.text}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                  {tags.length && (
                    <div className="variable-options-column">
                      <div className="variable-options-column-header text-center">Tags</div>
                      {tags.map((tag, index) => {
                        return (
                          <a
                            key={`${tag.text}`}
                            className={`${
                              tag.selected ? 'variable-option-tag pointer selected' : 'variable-option-tag pointer'
                            }`}
                            // ng-click="vm.selectTag(tag, $event)"
                          >
                            <span className="fa fa-fw variable-option-icon"></span>
                            <span
                              className="label-tag"
                              // tag-color-from-name="tag.text"
                            >
                              {tag.text}&nbsp;&nbsp;<i className="fa fa-tag"></i>&nbsp;
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}
