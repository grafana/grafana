import React, { PureComponent } from 'react';
import { trim } from 'lodash';
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
    }
  };

  onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (this.shouldUpdateValue(event.target.value)) {
      this.props.onChange(event.target.value);
    }
  };

  private shouldUpdateValue(value: string) {
    return trim(value ?? '').length > 0 || trim(this.props.value ?? '').length > 0;
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
