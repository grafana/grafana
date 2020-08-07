import React, { PureComponent } from 'react';
import { NavigationKey } from '../types';

export interface Props {
  onChange: (value: string) => void;
  onNavigate: (key: NavigationKey, clearOthers: boolean) => void;
  value: string | null;
}

export class VariableInput extends PureComponent<Props> {
  onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (NavigationKey[event.keyCode]) {
      const clearOthers = event.ctrlKey || event.metaKey || event.shiftKey;
      this.props.onNavigate(event.keyCode as NavigationKey, clearOthers);
      event.preventDefault();
    }
  };

  onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.props.onChange(event.target.value);
  };

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
