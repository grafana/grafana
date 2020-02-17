import React, { ChangeEvent, PureComponent } from 'react';
import debounce from 'lodash/debounce';
import { ClickOutsideWrapper } from '@grafana/ui';

import { QueryVariableModel } from '../variable';
import { dispatch } from '../../../store/store';
import { toVariablePayload } from '../state/actions';
import { QueryVariablePickerState } from '../state/queryVariableReducer';
import { variableAdapters } from '../adapters';
import {
  changeQueryVariableHighlightIndex,
  changeQueryVariableSearchQuery,
  hideQueryVariableDropDown,
  searchQueryChanged,
  selectVariableOptionByHighlightIndex,
} from '../state/queryVariableActions';
import { VariablePickerProps } from '../state/types';

export interface Props extends VariablePickerProps<QueryVariableModel, QueryVariablePickerState> {}

enum NavigationKeys {
  moveUp = 38,
  moveDown = 40,
  select = 32,
  cancel = 27,
  selectAndClose = 13,
}

export class VariableOptionsInput extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
    this.debouncedOnChangeQuery = debounce(this.debouncedOnChangeQuery, 200);
  }

  onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.keyCode === NavigationKeys.cancel) {
      return this.commitChanges();
    }

    if (event.keyCode === NavigationKeys.moveDown) {
      const payload = toVariablePayload(this.props.variable, 1);
      return dispatch(changeQueryVariableHighlightIndex(payload));
    }

    if (event.keyCode === NavigationKeys.moveUp) {
      const payload = toVariablePayload(this.props.variable, -1);
      return dispatch(changeQueryVariableHighlightIndex(payload));
    }

    const { uuid } = this.props.variable;
    const { highlightIndex } = this.props.picker;

    if (event.keyCode === NavigationKeys.select) {
      return dispatch(selectVariableOptionByHighlightIndex(uuid!, highlightIndex));
    }

    if (event.keyCode === NavigationKeys.selectAndClose) {
      dispatch(selectVariableOptionByHighlightIndex(uuid!, highlightIndex));
      return this.commitChanges();
    }
  };

  commitChanges = () => {
    const { oldVariableText } = this.props.picker;

    if (this.props.variable.current.text !== oldVariableText) {
      variableAdapters.get(this.props.variable.type).setValue(this.props.variable, this.props.variable.current);
    }

    dispatch(hideQueryVariableDropDown(toVariablePayload(this.props.variable)));
  };

  debouncedOnChangeQuery = (searchQuery: string) => {
    dispatch(searchQueryChanged(this.props.variable.uuid, searchQuery));
  };

  onQueryChanged = (event: ChangeEvent<HTMLInputElement>) => {
    const searchQuery = event.target.value;
    dispatch(changeQueryVariableSearchQuery(toVariablePayload(this.props.variable, searchQuery)));
    this.debouncedOnChangeQuery(searchQuery);
  };

  onCloseDropDown = () => {
    this.commitChanges();
  };

  render() {
    const { searchQuery } = this.props.picker;

    if (!this.props.variable) {
      return <div>Couldn't load variable</div>;
    }

    return (
      <ClickOutsideWrapper onClick={this.onCloseDropDown}>
        <input
          ref={instance => {
            if (instance) {
              instance.focus();
              instance.setAttribute('style', `width:${Math.max(instance.width, 80)}px`);
            }
          }}
          type="text"
          className="gf-form-input"
          value={searchQuery ?? ''}
          onChange={this.onQueryChanged}
          onKeyDown={this.onKeyDown}
        />
      </ClickOutsideWrapper>
    );
  }
}
