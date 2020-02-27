import React, { MouseEvent, PureComponent } from 'react';
import { e2e } from '@grafana/e2e';

import { dispatch } from '../../../store/store';
import { toVariablePayload } from '../state/actions';
import { getLinkText } from '../query/reducer';
import { showVariableDropDown } from '../state/actions';
import { VariablePickerProps } from '../state/types';
import { CustomVariableModel } from '../variable';
import { CustomVariablePickerState } from './reducer';

export interface Props extends VariablePickerProps<CustomVariableModel, CustomVariablePickerState> {}

export class CustomVariableOptionsLinkText extends PureComponent<Props> {
  onShowDropDown = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    event.preventDefault();
    dispatch(showVariableDropDown(toVariablePayload(this.props.variable)));
  };

  render() {
    if (!this.props.variable) {
      return <div>Couldn't load variable</div>;
    }

    const linkText = getLinkText(this.props.variable);

    return (
      <a
        onClick={this.onShowDropDown}
        className="variable-value-link"
        aria-label={e2e.pages.Dashboard.SubMenu.selectors.submenuItemValueDropDownValueLinkTexts(`${linkText}`)}
      >
        {linkText}
        <i className="fa fa-caret-down" style={{ fontSize: '12px' }}></i>
      </a>
    );
  }
}
