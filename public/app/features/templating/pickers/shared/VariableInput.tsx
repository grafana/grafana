import React, { PureComponent } from 'react';
import debounce from 'lodash/debounce';

export interface Props {
  onChange: (value: string) => void;
  onKeyDown: (key: NavigationKeys) => void;
  onSearch: (value: string) => void;
  value: string;
}

export enum NavigationKeys {
  moveUp = 38,
  moveDown = 40,
  select = 32,
  cancel = 27,
  selectAndClose = 13,
}

export class VariableInput extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
    this.onSearchWithDebounce = debounce(this.onSearchWithDebounce, 200);
  }

  onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (NavigationKeys[event.keyCode]) {
      this.props.onKeyDown(event.keyCode as NavigationKeys);
    }
  };

  onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.props.onChange(event.target.value);
    this.onSearchWithDebounce(event.target.value);
  };

  onSearchWithDebounce = (value: string) => this.props.onSearch(value);

  render() {
    return (
      <input
        ref={instance => {
          if (instance) {
            instance.focus();
            instance.setAttribute('style', `width:${Math.max(instance.width, 80)}px`);
          }
        }}
        type="text"
        className="gf-form-input"
        value={this.props.value ?? ''}
        onChange={this.onChange}
        onKeyDown={this.onKeyDown}
      />
    );
  }
}
