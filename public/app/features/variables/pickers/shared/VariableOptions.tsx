import React, { PureComponent } from 'react';
import { getTagColorsFromName, Icon, Tooltip } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import { VariableOption, VariableTag } from '../../../templating/types';

export interface Props {
  multi: boolean;
  values: VariableOption[];
  selectedValues: VariableOption[];
  tags: VariableTag[];
  highlightIndex: number;
  onToggle: (option: VariableOption, clearOthers: boolean) => void;
  onToggleAll: () => void;
  onToggleTag: (tag: VariableTag) => void;
}

export class VariableOptions extends PureComponent<Props> {
  onToggle = (option: VariableOption) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    const clearOthers = event.shiftKey || event.ctrlKey || event.metaKey;
    this.handleEvent(event);
    this.props.onToggle(option, clearOthers);
  };

  onToggleAll = (event: React.MouseEvent<HTMLAnchorElement>) => {
    this.handleEvent(event);
    this.props.onToggleAll();
  };

  onToggleTag = (tag: VariableTag) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    this.handleEvent(event);
    this.props.onToggleTag(tag);
  };

  handleEvent(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  render() {
    const { multi, values, tags } = this.props;

    return (
      <div
        className={`${multi ? 'variable-value-dropdown multi' : 'variable-value-dropdown single'}`}
        aria-label={selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown}
      >
        <div className="variable-options-wrapper">
          <div className="variable-options-column">
            {this.renderMultiToggle()}
            {values.map((option, index) => this.renderOption(option, index))}
          </div>
          {this.renderTags(tags)}
        </div>
      </div>
    );
  }

  renderTags(tags: VariableTag[]) {
    if (tags.length === 0) {
      return null;
    }

    return (
      <div className="variable-options-column">
        <div className="variable-options-column-header text-center">Tags</div>
        {tags.map(tag => this.renderTag(tag))}
      </div>
    );
  }

  renderTag(tag: VariableTag) {
    const { color, borderColor } = getTagColorsFromName(tag.text.toString());

    return (
      <a
        key={`${tag.text}`}
        className={`${tag.selected ? 'variable-option-tag pointer selected' : 'variable-option-tag pointer'}`}
        onClick={this.onToggleTag(tag)}
      >
        <span className="fa fa-fw variable-option-icon"></span>
        <span className="label-tag" style={{ backgroundColor: color, borderColor }}>
          {tag.text}&nbsp;&nbsp;
          <Icon name="tag-alt" />
          &nbsp;
        </span>
      </a>
    );
  }

  renderOption(option: VariableOption, index: number) {
    const { highlightIndex } = this.props;
    const selectClass = option.selected ? 'variable-option pointer selected' : 'variable-option pointer';
    const highlightClass = index === highlightIndex ? `${selectClass} highlighted` : selectClass;

    return (
      <a key={`${option.value}`} className={highlightClass} onClick={this.onToggle(option)}>
        <span className="variable-option-icon"></span>
        <span aria-label={selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts(`${option.text}`)}>
          {option.text}
        </span>
      </a>
    );
  }

  renderMultiToggle() {
    const { multi, selectedValues } = this.props;

    if (!multi) {
      return null;
    }

    return (
      <Tooltip content={'Clear selections'} placement={'top'}>
        <a
          className={`${
            selectedValues.length > 1
              ? 'variable-options-column-header many-selected'
              : 'variable-options-column-header'
          }`}
          onClick={this.onToggleAll}
          data-placement="top"
        >
          <span className="variable-option-icon"></span>
          Selected ({selectedValues.length})
        </a>
      </Tooltip>
    );
  }
}
