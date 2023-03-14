import React, { PureComponent } from 'react';

import { t } from 'app/core/internationalization';

import { NavigationKey } from '../types';

export interface Props extends Omit<React.HTMLProps<HTMLInputElement>, 'onChange' | 'value'> {
  onChange: (value: string) => void;
  onNavigate: (key: NavigationKey, clearOthers: boolean) => void;
  value: string | null;
}

export class VariableInput extends PureComponent<Props> {
  onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (NavigationKey[event.keyCode] && event.keyCode !== NavigationKey.select) {
      const clearOthers = event.ctrlKey || event.metaKey || event.shiftKey;
      this.props.onNavigate(event.keyCode as NavigationKey, clearOthers);
      event.preventDefault();
    }
  };

  onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.props.onChange(event.target.value);
  };

  render() {
    const { value, id, onNavigate, ...restProps } = this.props;
    return (
      <input
        {...restProps}
        ref={(instance) => {
          if (instance) {
            instance.focus();
            instance.setAttribute('style', `width:${Math.max(instance.width, 150)}px`);
          }
        }}
        type="text"
        className="gf-form-input"
        value={value ?? ''}
        onChange={this.onChange}
        onKeyDown={this.onKeyDown}
        placeholder={t('variable.dropdown.placeholder', 'Enter variable value')}
      />
    );
  }
}
