import { debounce } from 'lodash';
import React, { useCallback, useMemo, useRef } from 'react';

import { Field, FieldProps } from '../Forms/Field';
import { InlineToast } from '../InlineToast/InlineToast';

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

export interface Props extends FieldProps {
  //Function to be run onBlur or when finishing writing
  onFinishChange: (inputValue: string | number | readonly string[] | undefined) => Promise<void>;
  saveErrorMessage?: string;
  label: string;
  required: boolean;
}

const SHOW_SUCCESS_DURATION = 2 * 1000;

export const AutoSaveInput = React.forwardRef<FieldProps, Props>((props) => {
  const {
    className,
    invalid,
    loading,
    disabled,
    onFinishChange,
    saveErrorMessage = 'Error saving this value',
    error,
    children,
    ...restProps
  } = props;
  const [isLoading, setIsLoading] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [showError, setShowError] = React.useState(invalid);
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
      if (invalid) {
        return;
      }
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
        });
    },
    [onFinishChange, invalid]
  );

  const lodashDebounce = useMemo(() => debounce(handleChange, 600, { leading: false }), [handleChange]);

  /**
   * use Field around input to pass the error message
   * use InlineToast.tsx to show the save message
   */
  return (
    <Field {...restProps} invalid={invalid || showError} error={error || (showError && saveErrorMessage)}>
      <>
        {React.cloneElement(children, {
          ref: inputRef,
          onChange: (event: React.FormEvent<HTMLInputElement>) => {
            lodashDebounce(event.currentTarget.value);
          },
          loading: isLoading,
          disabled: disabled,
          invalid: invalid || showError,
        })}
        {showSuccess && (
          <InlineToast suffixIcon={'check'} referenceElement={inputRef.current} placement={'right'}>
            Saved!
          </InlineToast>
        )}
      </>
    </Field>
  );
});

AutoSaveInput.displayName = 'AutoSaveInput';
