import React, { MouseEvent, PureComponent } from 'react';
import { getTagColorsFromName } from '@grafana/ui';
import { e2e } from '@grafana/e2e';

import { QueryVariableModel } from '../variable';
import { dispatch } from '../../../store/store';
import { toVariablePayload } from '../state/actions';
import { QueryVariablePickerState } from '../state/queryVariableReducer';
import { showQueryVariableDropDown } from '../state/queryVariableActions';
import { VariablePickerProps } from '../state/types';

export interface Props extends VariablePickerProps<QueryVariableModel, QueryVariablePickerState> {}

export class VariableOptionsLinkText extends PureComponent<Props> {
  onShowDropDown = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    event.preventDefault();
    dispatch(showQueryVariableDropDown(toVariablePayload(this.props.variable)));
  };

  render() {
    const { linkText, selectedTags } = this.props.picker;

    if (!this.props.variable) {
      return <div>Couldn't load variable</div>;
    }

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
