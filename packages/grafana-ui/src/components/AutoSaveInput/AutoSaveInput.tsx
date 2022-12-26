import { debounce } from 'lodash';
import React from 'react';

import { Input, Props as InputProps } from '../Input/Input';

import { AutoSaveBadge } from './AutoSaveBadge';

/**
1.- Use the Input component as a base
2.- Just save if there is any change and when it loses focus
3.- Set the loading to true while the backend is saving
4.- Be aware of the backend response. If there is an error show a proper message and return the focus to the input.
5.- Add aria-live="polite" and check how it works in a screen-reader.
Debounce instead of working with onBlur?
import debouncePromise from 'debounce-promise';
or
import { debounce} from 'lodash';
 */

export interface Props extends InputProps {
  //Function to be run onBlur or when finishing writing
  onFinishChange: (string: string) => Promise<void>;
}

enum AutoSaveState {
  DEFAULT_STATE = 'defaultState',
  SAVED_STATE = 'savedState',
  ERROR_STATE = 'errorState',
}

export const AutoSaveInput = React.forwardRef<HTMLInputElement, Props>((props, ref) => {
  const {
    defaultValue = '',
    className,
    addonAfter,
    addonBefore,
    prefix,
    suffix,
    invalid,
    loading,
    onFinishChange,
    ...restProps
  } = props;
  const [value, setValue] = React.useState(defaultValue);
  const [isLoading, setIsLoading] = React.useState(false);
  const [autoSaveState, setAutoSaveState] = React.useState(AutoSaveState.DEFAULT_STATE);
  const [autoSaveIcon, setAutoSaveIcon] = React.useState('');

  //const debouncedValue = useMemo(()=> debounce(onFinishChange, 600), [onFinishChange]);

  const autoSaveInfo = (currentState: AutoSaveState) => {
    switch (currentState) {
      case 'savedState':
        return {
          icon: setAutoSaveIcon('check'),
          message: 'Saved!',
          action: () => null,
        };
        break;
      case 'errorState':
        return {
          icon: setAutoSaveIcon('repeat'),
          message: 'Error saving',
          action: () => null, //change it to return focus to input
        };
        break;
      default:
        return {
          icon: setAutoSaveIcon(''),
          message: '',
          action: () => null,
        };
        break;
    }
  };

  const saveInputValue = async (event: React.FormEvent<HTMLInputElement>) => {
    if (value !== event.currentTarget.value) {
      setIsLoading(true);
      try {
        await onFinishChange(event.currentTarget.value);
        setValue(event.currentTarget.value);
        setAutoSaveState(AutoSaveState.SAVED_STATE);
        setIsLoading(false);
      } catch {
        setAutoSaveState(AutoSaveState.ERROR_STATE);
        setIsLoading(false);
      }
      autoSaveInfo(autoSaveState);
    }
  };

  /**
   * use Field around input to pass the error message
   * use InlineToast.tsx to show the save message
   */
  return (
    <Input
      {...restProps}
      ref={ref}
      value={value.toString()}
      addonAfter={
        <AutoSaveBadge
          // icon={autoSaveIcon}
          text={autoSaveInfo(autoSaveState).message}
        />
      }
      onChange={(event) => {
        saveInputValue(event);
      }}
      loading={isLoading}
      data-testid={'autosave-input'}
    />
  );
});

AutoSaveInput.displayName = 'AutoSaveInput';
