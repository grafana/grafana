import { css } from '@emotion/css';
import React, { FormEvent, memo, useEffect, useRef, useState } from 'react';
import { Popper as ReactPopper } from 'react-popper';

import { GrafanaTheme2, VariableSuggestion } from '@grafana/data';
import { CustomScrollbar, FieldValidationMessage, Input, Portal, useTheme2 } from '@grafana/ui';
import { DataLinkSuggestions } from '@grafana/ui/src/components/DataLinks/DataLinkSuggestions';

const modulo = (a: number, n: number) => a - n * Math.floor(a / n);
const ERROR_TOOLTIP_OFFSET = 8;

interface SuggestionsInputProps {
  value: string;
  onChange: (url: string, callback?: () => void) => void;
  suggestions: VariableSuggestion[];
  placeholder?: string;
  invalid?: boolean;
  error?: string;
  width?: number;
}

const getStyles = (theme: GrafanaTheme2, inputHeight: number) => {
  return {
    suggestionsWrapper: css({
      boxShadow: theme.shadows.z2,
    }),
    errorTooltip: css({
      position: 'absolute',
      top: inputHeight + ERROR_TOOLTIP_OFFSET + 'px',
      zIndex: theme.zIndex.tooltip,
    }),
    inputWrapper: css({
      position: 'relative',
    }),
    // Wrapper with child selector needed.
    // When classnames are applied to the same element as the wrapper, it causes the suggestions to stop working
  };
};

// This memoised also because rerendering the slate editor grabs focus which created problem in some cases this
// was used and changes to different state were propagated here.
export const SuggestionsInput = memo(
  ({ value, onChange, suggestions, placeholder, error, invalid = false }: SuggestionsInputProps) => {
    const [showingSuggestions, setShowingSuggestions] = useState(false);
    const [suggestionsIndex, setSuggestionsIndex] = useState(0);
    const [variableValue, setVariableValue] = useState<string>(value);
    // const prevVariableValue = usePrevious<Value>(variableValue);
    const [scrollTop, setScrollTop] = useState(0);
    const [inputHeight, setInputHeight] = useState<number>(0);

    const theme = useTheme2();
    const styles = getStyles(theme, inputHeight);

    // Workaround for https://github.com/ianstormtaylor/slate/issues/2927
    const stateRef = useRef({ showingSuggestions, suggestions, suggestionsIndex, variableValue, onChange });
    stateRef.current = { showingSuggestions, suggestions, suggestionsIndex, variableValue, onChange };

    const inputRef = useRef<HTMLInputElement>(null);

    // Used to get the height of the suggestion elements in order to scroll to them.
    const activeRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      setScrollTop(getElementPosition(activeRef.current, suggestionsIndex));
    }, [suggestionsIndex]);

    const onKeyDown = React.useCallback((event: React.KeyboardEvent) => {
      if (!stateRef.current.showingSuggestions) {
        if (event.key === '=' || event.key === '$' || (event.keyCode === 32 && event.ctrlKey)) {
          return setShowingSuggestions(true);
        }
        return;
      }

      switch (event.key) {
        case 'Backspace':
        case 'Escape':
          setShowingSuggestions(false);
          return setSuggestionsIndex(0);

        case 'Enter':
          event.preventDefault();
          return onVariableSelect(stateRef.current.suggestions[stateRef.current.suggestionsIndex]);

        case 'ArrowDown':
        case 'ArrowUp':
          event.preventDefault();
          const direction = event.key === 'ArrowDown' ? 1 : -1;
          return setSuggestionsIndex((index) => modulo(index + direction, stateRef.current.suggestions.length));
        default:
          return;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // useEffect(() => {
    //   // Update the state of the link in the parent. This is basically done on blur but we need to do it after
    //   // our state have been updated. The duplicity of state is done for perf reasons and also because local
    //   // state also contains things like selection and formating.
    //   if (prevVariableValue && prevVariableValue.selection.isFocused && !variableValue.selection.isFocused) {
    //     stateRef.current.onChange(Plain.serialize(variableValue));
    //   }
    // }, [variableValue, prevVariableValue]);

    const onVariableChange = React.useCallback((event: FormEvent<HTMLInputElement>) => {
      setVariableValue(event.currentTarget.value);
    }, []);

    const onBlur = React.useCallback((event: FormEvent<HTMLInputElement>) => {
      stateRef.current.onChange(event.currentTarget.value);
    }, []);

    const onVariableSelect = (item: VariableSuggestion, input = inputRef.current!) => {
      const curPos = input.selectionStart!;
      const x = input.value;

      if (x[curPos - 1] === '$') {
        input.value = x.slice(0, curPos) + item.value + x.slice(curPos);
      } else {
        input.value = x.slice(0, curPos) + '$' + item.value + x.slice(curPos);
      }

      setVariableValue(input.value);
      setShowingSuggestions(false);

      setSuggestionsIndex(0);
      stateRef.current.onChange(input.value);
    };

    useEffect(() => {
      setInputHeight(inputRef.current!.clientHeight);
    }, []);

    return (
      <div className={styles.inputWrapper}>
        {showingSuggestions && (
          <Portal>
            <ReactPopper
              referenceElement={inputRef.current!}
              placement="bottom-start"
              modifiers={[
                {
                  name: 'preventOverflow',
                  enabled: true,
                  options: {
                    rootBoundary: 'viewport',
                  },
                },
                {
                  name: 'arrow',
                  enabled: false,
                },
                {
                  name: 'offset',
                  options: {
                    offset: [0, 0],
                  },
                },
              ]}
            >
              {({ ref, style, placement }) => {
                return (
                  <div ref={ref} style={style} data-placement={placement} className={styles.suggestionsWrapper}>
                    <CustomScrollbar
                      scrollTop={scrollTop}
                      autoHeightMax="300px"
                      setScrollTop={({ scrollTop }) => setScrollTop(scrollTop)}
                    >
                      {/* This suggestion component has a specialized name,
                          but is rather generalistic in implementation,
                          so we're using it in transformations also. 
                          We should probably rename this to something more general. */}
                      <DataLinkSuggestions
                        activeRef={activeRef}
                        suggestions={stateRef.current.suggestions}
                        onSuggestionSelect={onVariableSelect}
                        onClose={() => setShowingSuggestions(false)}
                        activeIndex={suggestionsIndex}
                      />
                    </CustomScrollbar>
                  </div>
                );
              }}
            </ReactPopper>
          </Portal>
        )}
        {/* {invalid && (
          <Portal>
            <ReactPopper
              referenceElement={inputRef.current!}
              placement="bottom-start"
            >
              {({ ref, style, placement }) => {
                return (
                  <div ref={ref} style={style} data-placement={placement} className={styles.suggestionsWrapper}>
                    <FieldValidationMessage>{error}</FieldValidationMessage>
                  </div>
                );
              }}
            </ReactPopper>
          </Portal>
        )} */}
        {invalid && (
          <div className={styles.errorTooltip}>
            <FieldValidationMessage>{error}</FieldValidationMessage>
          </div>
        )}
        <Input
          placeholder={placeholder}
          invalid={invalid}
          ref={inputRef}
          value={stateRef.current.variableValue}
          onChange={onVariableChange}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
        />
      </div>
    );
  }
);

SuggestionsInput.displayName = 'SuggestionsInput';

function getElementPosition(suggestionElement: HTMLElement | null, activeIndex: number) {
  return (suggestionElement?.clientHeight ?? 0) * activeIndex;
}
