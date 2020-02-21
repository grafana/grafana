import React, { MouseEvent, PureComponent } from 'react';
import { getTagColorsFromName } from '@grafana/ui';
import { e2e } from '@grafana/e2e';

import { QueryVariableModel } from '../variable';
import { dispatch } from '../../../store/store';
import { toVariablePayload } from '../state/actions';
import { getLinkText, QueryVariablePickerState } from '../query/reducer';
import { showQueryVariableDropDown } from '../query/actions';
import { VariablePickerProps } from '../state/types';

export interface Props extends VariablePickerProps<QueryVariableModel, QueryVariablePickerState> {}

export class VariableOptionsLinkText extends PureComponent<Props> {
  onShowDropDown = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    event.preventDefault();
    dispatch(showQueryVariableDropDown(toVariablePayload(this.props.variable)));
  };

  render() {
    if (!this.props.variable) {
      return <div>Couldn't load variable</div>;
    }

    const linkText = getLinkText(this.props.variable);
    const selectedTags = this.props.variable.tags.filter(t => t.selected);

    return (
      <a
        onClick={this.onShowDropDown}
        className="variable-value-link"
        aria-label={e2e.pages.Dashboard.SubMenu.selectors.submenuItemValueDropDownValueLinkTexts(`${linkText}`)}
      >
        {linkText}
        {selectedTags.map(tag => {
          const { color, borderColor } = getTagColorsFromName(tag.text.toString());
          return (
            <span bs-tooltip="tag.valuesText" data-placement="bottom" key={`${tag.text}`}>
              <span className="label-tag" style={{ backgroundColor: color, borderColor }}>
                &nbsp;&nbsp;<i className="fa fa-tag"></i>&nbsp; {tag.text}
              </span>
            </span>
          );
        })}
        <i className="fa fa-caret-down" style={{ fontSize: '12px' }}></i>
      </a>
    );
  }
}
