import React, { MouseEvent, PureComponent } from 'react';
import debounce from 'lodash/debounce';
import { ClickOutsideWrapper } from '@grafana/ui';

import { QueryVariableModel, VariableOption } from '../variable';
import { dispatch } from '../../../store/store';
import { toVariablePayload } from '../state/actions';
import { QueryVariablePickerState } from '../state/queryVariableReducer';
import { variableAdapters } from '../adapters';
import { hideQueryVariableDropDown, selectVariableOption } from '../state/queryVariableActions';
import { VariablePickerProps } from '../state/types';

export interface Props extends VariablePickerProps<QueryVariableModel, QueryVariablePickerState> {}

export class VariableOptionsInput extends PureComponent<Props> {
  private readonly debouncedOnQueryChanged: Function;

  constructor(props: Props) {
    super(props);
    this.debouncedOnQueryChanged = debounce((searchQuery: string) => {
      this.onQueryChanged(searchQuery);
    }, 200);
  }

  onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {};

  selectValue = (option: VariableOption) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    event.preventDefault();

    if (!option) {
      return;
    }

    dispatch(selectVariableOption(toVariablePayload(this.props.variable, { option, forceSelect: false, event })));
  };

  commitChanges = () => {
    const { queryHasSearchFilter, oldVariableText } = this.props.picker;

    if (queryHasSearchFilter) {
      // this.updateLazyLoadedOptions();
    }

    if (this.props.variable.current.text !== oldVariableText) {
      variableAdapters.get(this.props.variable.type).setValue(this.props.variable, this.props.variable.current);
    }
    dispatch(hideQueryVariableDropDown(toVariablePayload(this.props.variable)));
  };

  onQueryChanged = (searchQuery: string) => {};

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
          onChange={event => this.debouncedOnQueryChanged(event.target.value)}
          onKeyDown={this.onKeyDown}
          // ng-model="vm.search.query"
          // ng-change="vm.debouncedQueryChanged()"
        />
      </ClickOutsideWrapper>
    );
  }
}
