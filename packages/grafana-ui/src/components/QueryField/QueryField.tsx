import { css, cx } from '@emotion/css';
import { debounce } from 'lodash';
import { lazy, memo, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as React from 'react';
import { type Value } from 'slate';
import Plain from 'slate-plain-serializer';
import { type Editor, type EventHook, type Plugin } from 'slate-react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { ClearPlugin } from '../../slate-plugins/clear';
import { ClipboardPlugin } from '../../slate-plugins/clipboard';
import { IndentationPlugin } from '../../slate-plugins/indentation';
import { NewlinePlugin } from '../../slate-plugins/newline';
import { RunnerPlugin } from '../../slate-plugins/runner';
import { SelectionShortcutsPlugin } from '../../slate-plugins/selection_shortcuts';
import { SuggestionsPlugin } from '../../slate-plugins/suggestions';
import { useStyles2 } from '../../themes/ThemeContext';
import { getFocusStyles } from '../../themes/mixins';
import { type SuggestionsState, type TypeaheadInput, type TypeaheadOutput } from '../../types/completion';
import { makeValue, SCHEMA } from '../../utils/slate';
import { LoadingPlaceholder } from '../LoadingPlaceholder/LoadingPlaceholder';

const LazyEditor = lazy(() => import('slate-react').then((module) => ({ default: module.Editor })));

export interface QueryFieldProps {
  additionalPlugins?: Plugin[];
  ['aria-labelledby']?: string;
  cleanText?: (text: string) => string;
  disabled?: boolean;
  // We have both value and local state. This is usually an antipattern but we need to keep local state
  // for perf reasons and also have outside value in for example in Explore redux that is mutable from logs
  // creating a two way binding.
  query?: string | null;
  onRunQuery?: () => void;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onRichValueChange?: (value: Value) => void;
  onClick?: EventHook<React.MouseEvent<Element, MouseEvent>>;
  onTypeahead?: (typeahead: TypeaheadInput) => Promise<TypeaheadOutput>;
  onWillApplySuggestion?: (suggestion: string, state: SuggestionsState) => string;
  placeholder?: string;
  portalOrigin: string;
  syntax?: string;
  syntaxLoaded?: boolean;
}

/**
 * Renders an editor field.
 * Pass initial value as initialQuery and listen to changes in props.onValueChanged.
 * This component can only process strings. Internally it uses Slate Value.
 * Implement props.onTypeahead to use suggestions.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-deprecated-queryfield--docs
 *
 * @deprecated
 */
export const QueryField = memo(function QueryField({
  additionalPlugins,
  ['aria-labelledby']: ariaLabelledby,
  cleanText: cleanTextProp,
  disabled,
  query,
  onRunQuery,
  // By default QueryField calls onChange if onBlur is not defined, this will trigger a rerender
  // And slate will claim the focus, making it impossible to leave the field.
  onBlur = () => {},
  onChange,
  onRichValueChange,
  onClick,
  onTypeahead,
  onWillApplySuggestion,
  placeholder,
  portalOrigin,
  syntax,
  syntaxLoaded,
}: QueryFieldProps) {
  const [value, setValue] = useState(() => makeValue(query || '', syntax));
  const [prevQuery, setPrevQuery] = useState(query);
  const editorRef = useRef<Editor | null>(null);
  const prevSyntaxLoaded = useRef(syntaxLoaded);
  const styles = useStyles2(getStyles);

  // The debounced onChange and the Slate plugins are created once, so they read the latest props through this ref
  const latest = useRef({ onChange, onRunQuery, value });
  useLayoutEffect(() => {
    latest.current = { onChange, onRunQuery, value };
  });

  const [{ runOnChangeDebounced, runOnChangeAndRunQuery }] = useState(() => {
    const runOnChange = () => {
      const { onChange, value } = latest.current;
      onChange?.(cleanText(Plain.serialize(value)));
    };
    const runOnChangeDebounced = debounce(runOnChange, 500);
    return {
      runOnChangeDebounced,
      runOnChangeAndRunQuery: () => {
        // onRunQuery executes query from Redux in Explore so it needs to be updated sync in case we want to run
        // the query.
        runOnChangeDebounced.cancel();
        runOnChange();
        latest.current.onRunQuery?.();
      },
    };
  });
  useEffect(() => () => runOnChangeDebounced.cancel(), [runOnChangeDebounced]);

  const [plugins] = useState<Array<Plugin<Editor>>>(() =>
    [
      // SuggestionsPlugin and RunnerPlugin need to be before NewlinePlugin
      // because they override Enter behavior
      SuggestionsPlugin({ onTypeahead, cleanText: cleanTextProp, portalOrigin, onWillApplySuggestion }),
      RunnerPlugin({ handler: runOnChangeAndRunQuery }),
      NewlinePlugin(),
      ClearPlugin(),
      SelectionShortcutsPlugin(),
      IndentationPlugin(),
      ClipboardPlugin(),
      ...(additionalPlugins || []),
    ].filter((p) => p)
  );

  useEffect(() => {
    if (!prevSyntaxLoaded.current && syntaxLoaded && editorRef.current) {
      // Need a bogus edit to re-render the editor after syntax has fully loaded
      const editor = editorRef.current.insertText(' ').deleteBackward(1);
      handleChange(editor.value);
    }
    prevSyntaxLoaded.current = syntaxLoaded;
  });

  /**
   * Update local state and propagate change upstream.
   */
  const handleChange = (newValue: Value) => {
    if (onRichValueChange) {
      onRichValueChange(newValue);
    }

    setValue(newValue);

    // The diff is needed because the actual value of editor have much more metadata (for example text selection)
    // that is not passed upstream so every change of editor value does not mean change of the query text.
    const documentChanged = newValue.document !== value.document;
    if (documentChanged && Plain.serialize(value) !== Plain.serialize(newValue)) {
      // Debounce change propagation for perf reasons.
      runOnChangeDebounced();
    }
  };

  const handleBlur = (_event: React.FocusEvent | undefined, _editor: Editor, next: Function) => {
    onBlur();
    return next();
  };

  // Handle two way binging between local state and outside prop.
  // if query changed from the outside
  if (query !== prevQuery) {
    setPrevQuery(query);
    // and we have a version that differs
    if (query !== Plain.serialize(value)) {
      setValue(makeValue(query || '', syntax));
    }
  }

  return (
    <div
      className={cx(
        'slate-query-field__wrapper',
        {
          'slate-query-field__wrapper--disabled': disabled,
        },
        styles.wrapper
      )}
    >
      <div className="slate-query-field" data-testid={selectors.components.QueryField.container}>
        <Suspense fallback={<LoadingPlaceholder text={t('grafana-ui.query-field.loading', 'Loading editor')} />}>
          <LazyEditor
            ref={editorRef}
            aria-labelledby={ariaLabelledby}
            schema={SCHEMA}
            autoCorrect={false}
            readOnly={disabled}
            onBlur={handleBlur}
            onClick={onClick}
            onChange={(change: { value: Value }) => {
              handleChange(change.value);
            }}
            placeholder={placeholder}
            plugins={plugins}
            spellCheck={false}
            value={value}
          />
        </Suspense>
      </div>
    </div>
  );
});

function cleanText(text: string) {
  // RegExp with invisible characters we want to remove - currently only carriage return (newlines are visible)
  return text.replace(/[\r]/g, '');
}

const getStyles = (theme: GrafanaTheme2) => {
  const focusStyles = getFocusStyles(theme);
  return {
    wrapper: css({
      '&:focus-within': focusStyles,
    }),
  };
};
