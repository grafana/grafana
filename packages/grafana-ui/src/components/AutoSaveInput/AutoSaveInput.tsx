import { debounce } from 'lodash';
import React, { useCallback, useMemo, useRef } from 'react';

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
  onFinishChange: (inputValue: string | number | readonly string[] | undefined) => Promise<void>;
  customErrorMessage?: string;
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
    customErrorMessage,
    ...restProps
  } = props;
  const [isLoading, setIsLoading] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [showError, setShowError] = React.useState(false);
  const [showErrorMessage, setShowErrorMessage] = React.useState(customErrorMessage || 'Error saving this value');
  const inputRef = useRef<null | HTMLInputElement>(null);

  React.useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const time = showError ? 0 : SHOW_SUCCESS_DURATION;
    if (showSuccess) {
      timeoutId = setTimeout(() => {
        setShowSuccess(false);
      }, time);
    }

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showSuccess, showError]);

  const handleChange = useCallback(
    (nextValue) => {
      if (nextValue === '') {
        setShowError(true);
        setShowErrorMessage('Invalid value');
      } else {
        console.log(onFinishChange);
        setIsLoading(true);
        onFinishChange(nextValue)
          .then(() => {
            setIsLoading(false);
            setShowSuccess(true);
            setShowError(false);
          })
          .catch(() => {
            setIsLoading(false);
            setShowError(true);
            setShowErrorMessage(customErrorMessage || 'Error saving this value');
          });
      }
    },
    [customErrorMessage, onFinishChange]
  );

  const lodashDebounce = useMemo(() => debounce(handleChange, 600, { leading: false }), [handleChange]);

  /**
   * use Field around input to pass the error message
   * use InlineToast.tsx to show the save message
   */
  return (
    <Field label="" invalid={showError} error={showError && showErrorMessage}>
      <Input
        {...restProps}
        ref={inputRef}
        defaultValue={defaultValue}
        addonAfter={
          showSuccess && (
            <InlineToast suffixIcon={'check'} referenceElement={inputRef.current} placement={'right'}>
              Saved!
            </InlineToast>
          )
        }
        onChange={(event) => {
          lodashDebounce(event.currentTarget.value);
        }}
        loading={isLoading}
        data-testid={'autosave-input'}
      />
    </Field>
  );
});

AutoSaveInput.displayName = 'AutoSaveInput';
