// import { debounce } from 'lodash';
import React, { useRef } from 'react';

import { Field } from '../Forms/Field';
import { InlineToast } from '../InlineToast/InlineToast';
import { Input, Props as InputProps } from '../Input/Input';

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

const SHOW_SUCCESS_DURATION = 2 * 1000;

export const AutoSaveInput = React.forwardRef<HTMLInputElement, Props>((props) => {
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
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [showError, setShowError] = React.useState(false);
  //const debouncedValue = useMemo(()=> debounce(onFinishChange, 600), [onFinishChange]);
  const inputRef = useRef<null | HTMLInputElement>(null);
  React.useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    if (showSuccess) {
      timeoutId = setTimeout(() => {
        setShowSuccess(false);
      }, SHOW_SUCCESS_DURATION);
    }

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showSuccess]);

  const saveInputValue = async (event: React.FormEvent<HTMLInputElement>) => {
    if (value !== event.currentTarget.value) {
      setIsLoading(true);
      try {
        await onFinishChange(event.currentTarget.value);
        setValue(event.currentTarget.value);
        setIsLoading(false);
        setShowError(false);
      } catch {
        setIsLoading(false);
        setShowError(true);
      }
    }
  };

  /**
   * use Field around input to pass the error message
   * use InlineToast.tsx to show the save message
   */
  return (
    <Field label="" invalid={showError} error={showError && 'Error saving this value'}>
      <Input
        {...restProps}
        ref={inputRef}
        value={value.toString()}
        addonAfter={
          <InlineToast suffixIcon={'check'} referenceElement={inputRef.current} placement={'right'}>
            Saved!
          </InlineToast>
        }
        onChange={(event) => {
          saveInputValue(event);
        }}
        loading={isLoading}
        data-testid={'autosave-input'}
      />
    </Field>
  );
});

AutoSaveInput.displayName = 'AutoSaveInput';
