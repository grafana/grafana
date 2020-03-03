import React, { PureComponent } from 'react';
import { trim } from 'lodash';
export interface Props {
  onChange: (value: string) => void;
  onNavigate: (key: NavigationKeys, clearOthers: boolean) => void;
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
  onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (NavigationKeys[event.keyCode]) {
      const clearOthers = event.ctrlKey || event.metaKey || event.shiftKey;
      this.props.onNavigate(event.keyCode as NavigationKeys, clearOthers);
    }
  };

  onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (this.shouldUpdateValue(event.target.value)) {
      this.props.onChange(event.target.value);
    }
  };

  private shouldUpdateValue(value: string) {
    return trim(value).length > 0 || trim(this.props.value).length > 0;
  }

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
