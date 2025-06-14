import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { useCallback, useMemo, useRef } from 'react';
import * as React from 'react';

import { Trans } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Field, FieldProps } from '../Forms/Field';
import { InlineToast } from '../InlineToast/InlineToast';

import { EllipsisAnimated } from './EllipsisAnimated';

const SHOW_SUCCESS_DURATION = 2 * 1000;

export interface Props<T = string> extends Omit<FieldProps, 'children'> {
  /** Saving request that will be triggered 600ms after changing the value */
  onFinishChange: (inputValue: T) => Promise<void>;
  /** Custom error message to display on saving */
  saveErrorMessage?: string;
  /** Input that will save its value on change  */
  children: (onChange: (newValue: T) => void) => React.ReactElement;
}
export function AutoSaveField<T = string>(props: Props<T>) {
  const {
    invalid,
    loading,
    onFinishChange,
    saveErrorMessage = 'Error saving this value',
    error,
    children,
    disabled,
    ...restProps
  } = props;

  const [fieldState, setFieldState] = React.useState({
    isLoading: false,
    showSuccess: false,
    showError: invalid,
  });

  const fieldRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (fieldState.showSuccess) {
      const time = fieldState.showError ? 0 : SHOW_SUCCESS_DURATION;
      timeoutId = setTimeout(() => {
        setFieldState({ ...fieldState, showSuccess: false });
      }, time);
    }

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fieldState]);

  const handleChange = useCallback(
    (nextValue: T) => {
      if (invalid) {
        return;
      }
      setFieldState({ ...fieldState, isLoading: true, showSuccess: false });
      onFinishChange(nextValue)
        .then(() => {
          setFieldState({
            isLoading: false,
            showSuccess: true,
            showError: false,
          });
        })
        .catch(() => {
          setFieldState({
            ...fieldState,
            isLoading: false,
            showError: true,
          });
        });
    },
    [invalid, fieldState, onFinishChange]
  );

  const lodashDebounce = useMemo(() => debounce(handleChange, 600, { leading: false }), [handleChange]);
  //We never want to pass false to field, because it won't be deleted with deleteUndefinedProps() being false
  const isInvalid = invalid || fieldState.showError || undefined;
  /**
   * use Field around input to pass the error message
   * use InlineToast.tsx to show the save message
   */
  const styles = useStyles2(getStyles);

  return (
    <>
      <Field
        {...restProps}
        loading={loading || undefined}
        invalid={isInvalid}
        disabled={disabled}
        error={error || (fieldState.showError && saveErrorMessage)}
        ref={fieldRef}
        className={styles.widthFitContent}
      >
        {React.cloneElement(
          children((newValue) => {
            lodashDebounce(newValue);
          })
        )}
      </Field>
      {fieldState.isLoading && (
        <InlineToast referenceElement={fieldRef.current} placement="right">
          <Trans i18nKey="grafana-ui.auto-save-field.saving">
            Saving <EllipsisAnimated />
          </Trans>
        </InlineToast>
      )}
      {fieldState.showSuccess && (
        <InlineToast suffixIcon={'check'} referenceElement={fieldRef.current} placement="right">
          <Trans i18nKey="grafana-ui.auto-save-field.saved">Saved!</Trans>
        </InlineToast>
      )}
    </>
  );
}

AutoSaveField.displayName = 'AutoSaveField';

const getStyles = () => {
  return {
    widthFitContent: css({
      width: 'fit-content',
    }),
  };
};
