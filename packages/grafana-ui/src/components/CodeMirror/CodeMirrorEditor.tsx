import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, foldGutter, indentOnInput } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder as placeholderExtension,
  rectangularSelection,
  tooltips,
  ViewUpdate,
} from '@codemirror/view';
import { css, cx } from '@emotion/css';
import { memo, useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { getInputStyles } from '../Input/Input';

import { createGenericHighlighter } from './highlight';
import { createGenericTheme } from './styles';
import { CodeMirrorEditorProps } from './types';

export const CodeMirrorEditor = memo((props: CodeMirrorEditorProps) => {
  const {
    value,
    onChange,
    placeholder = '',
    themeFactory,
    highlighterFactory,
    highlightConfig,
    autocompletion: autocompletionExtension,
    extensions = [],
    showLineNumbers = false,
    lineWrapping = true,
    ariaLabel,
    className,
    useInputStyles = true,
    closeBrackets: enableCloseBrackets = true,
  } = props;
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const styles = useStyles2((theme) => getStyles(theme, useInputStyles));
  const theme = useTheme2();
  const themeCompartment = useRef(new Compartment());
  const autocompletionCompartment = useRef(new Compartment());

  const customKeymap = keymap.of([...closeBracketsKeymap, ...completionKeymap, ...historyKeymap, ...defaultKeymap]);

  // Build theme extensions
  const getThemeExtensions = () => {
    const themeExt = themeFactory ? themeFactory(theme) : createGenericTheme(theme);
    const highlighterExt =
      highlighterFactory && highlightConfig
        ? highlighterFactory(highlightConfig)
        : highlightConfig
          ? createGenericHighlighter(highlightConfig)
          : [];

    return [themeExt, highlighterExt];
  };

  // Initialize CodeMirror editor
  useEffect(() => {
    if (!editorContainerRef.current || editorViewRef.current) {
      return;
    }

    const baseExtensions = [
      highlightActiveLine(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      rectangularSelection(),
      customKeymap,
      placeholderExtension(placeholder),
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged) {
          const newValue = update.state.doc.toString();
          onChange(newValue);
        }
      }),
      tooltips({
        parent: document.body, // Render tooltips at body level to prevent clipping by modals
      }),
      themeCompartment.current.of(getThemeExtensions()),
      EditorState.phrases.of({
        next: 'Next',
        previous: 'Previous',
        Completions: 'Completions',
      }),
      EditorView.editorAttributes.of({ 'aria-label': ariaLabel || placeholder }),
    ];

    // Conditionally add closeBrackets extension
    if (enableCloseBrackets) {
      baseExtensions.push(closeBrackets());
    }

    // Add optional extensions
    if (showLineNumbers) {
      baseExtensions.push(lineNumbers());
    }

    if (lineWrapping) {
      baseExtensions.push(EditorView.lineWrapping);
    }

    if (autocompletionExtension) {
      baseExtensions.push(autocompletionCompartment.current.of(autocompletionExtension));
    }

    // Add custom extensions
    if (extensions.length > 0) {
      baseExtensions.push(...extensions);
    }

    const startState = EditorState.create({
      doc: value,
      extensions: baseExtensions,
    });

    const view = new EditorView({
      state: startState,
      parent: editorContainerRef.current,
    });

    editorViewRef.current = view;

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update editor value when prop changes
  useEffect(() => {
    if (editorViewRef.current) {
      const currentValue = editorViewRef.current.state.doc.toString();
      if (currentValue !== value) {
        editorViewRef.current.dispatch({
          changes: { from: 0, to: currentValue.length, insert: value },
        });
      }
    }
  }, [value]);

  // Update theme when it changes
  useEffect(() => {
    if (editorViewRef.current) {
      editorViewRef.current.dispatch({
        effects: themeCompartment.current.reconfigure(getThemeExtensions()),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, themeFactory, highlighterFactory, highlightConfig]);

  // Update autocompletion when it changes
  useEffect(() => {
    if (editorViewRef.current && autocompletionExtension) {
      editorViewRef.current.dispatch({
        effects: autocompletionCompartment.current.reconfigure(autocompletionExtension),
      });
    }
  }, [autocompletionExtension]);

  return (
    <div className={cx(styles.container, className)}>
      <div className={styles.input} ref={editorContainerRef} />
    </div>
  );
});

CodeMirrorEditor.displayName = 'CodeMirrorEditor';

const getStyles = (theme: GrafanaTheme2, useInputStyles: boolean) => {
  const baseInputStyles = useInputStyles ? getInputStyles({ theme, invalid: false }).input : {};

  return {
    container: css({
      position: 'relative',
      width: '100%',
    }),
    input: css(baseInputStyles),
  };
};
