import { memo, type KeyboardEvent, type HTMLProps } from 'react';

import { t } from '@grafana/i18n';
import { Input } from '@grafana/ui';

import { NavigationKey } from '../types';

export interface Props extends Omit<HTMLProps<HTMLInputElement>, 'onChange' | 'value'> {
  onChange: (value: string) => void;
  onNavigate: (key: NavigationKey, clearOthers: boolean) => void;
  value: string | null;
}

export const VariableInput = memo(({ value, id, onNavigate, onChange, ...restProps }: Props) => {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (NavigationKey[event.keyCode] && event.keyCode !== NavigationKey.select) {
      const clearOthers = event.ctrlKey || event.metaKey || event.shiftKey;
      onNavigate(event.keyCode, clearOthers);
      event.preventDefault();
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <Input
      {...restProps}
      width={19}
      autoFocus
      id={id}
      type="text"
      value={value ?? ''}
      onChange={handleChange}
      onKeyDown={onKeyDown}
      placeholder={t('variable.dropdown.placeholder', 'Enter variable value')}
    />
  );
});
VariableInput.displayName = 'VariableInput';
