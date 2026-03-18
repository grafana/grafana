import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';
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

/**
 * A reusable CodeMirror 6 editor component that integrates with Grafana's
 * theme system and supports pluggable syntax highlighting and autocompletion.
 *
 * The EditorView is created once in a mount effect — React does not own the
 * DOM inside the editor container.  Two Compartments allow dynamic
 * reconfiguration of theme/highlight and autocompletion without rebuilding
 * the full editor state.
 */
export const CodeMirrorEditor = memo((props: CodeMirrorEditorProps) => {
  const {
    value,
    onChange,
    onBlur,
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

  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const styles = useStyles2((theme) => getStyles(theme, useInputStyles));
  const theme = useTheme2();
  const themeCompartment = useRef(new Compartment());
  const autocompletionCompartment = useRef(new Compartment());

  const customKeymap = keymap.of([...closeBracketsKeymap, ...completionKeymap, ...historyKeymap, ...defaultKeymap]);

  const getThemeExtensions = () => {
    const themeExt = themeFactory ? themeFactory(theme) : createGenericTheme(theme);
    const highlighterExt = highlighterFactory
      ? highlighterFactory(highlightConfig)
      : highlightConfig
        ? createGenericHighlighter(highlightConfig)
        : [];
    return [themeExt, highlighterExt];
  };

  // Initialize the EditorView once on mount.
  // StrictMode guard: `if (!containerRef.current || viewRef.current) return;`
  // prevents double-initialization when React 18 StrictMode runs effects twice.
  useEffect(() => {
    if (!containerRef.current || viewRef.current) {
      return;
    }

    const baseExtensions = [
      highlightActiveLine(),
      highlightSpecialChars(),
      history(),
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
          onChange(update.state.doc.toString());
        }
      }),
      EditorView.domEventHandlers({
        blur: (_, view) => {
          if (onBlur) {
            onBlur(view.state.doc.toString());
          }
        },
      }),
      themeCompartment.current.of(getThemeExtensions()),
      EditorView.contentAttributes.of({ 'aria-label': ariaLabel || placeholder || 'Code editor' }),
    ];

    if (enableCloseBrackets) {
      baseExtensions.push(closeBrackets());
    }

    if (showLineNumbers) {
      baseExtensions.push(lineNumbers());
    }

    if (lineWrapping) {
      baseExtensions.push(EditorView.lineWrapping);
    }

    if (autocompletionExtension) {
      baseExtensions.push(autocompletionCompartment.current.of(autocompletionExtension));
    }

    if (extensions.length > 0) {
      baseExtensions.push(...extensions);
    }

    const startState = EditorState.create({
      doc: value,
      extensions: baseExtensions,
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Controlled value sync — avoids an infinite loop because dispatching the
  // same content produces no docChanged event, so onChange won't re-fire.
  useEffect(() => {
    if (!viewRef.current) {
      return;
    }
    const current = viewRef.current.state.doc.toString();
    if (current !== value) {
      viewRef.current.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  // Reconfigure theme/highlight when Grafana theme or factory props change.
  useEffect(() => {
    if (!viewRef.current) {
      return;
    }
    viewRef.current.dispatch({
      effects: themeCompartment.current.reconfigure(getThemeExtensions()),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, themeFactory, highlighterFactory, highlightConfig]);

  // Reconfigure autocompletion extension when suggestions change.
  useEffect(() => {
    if (!viewRef.current || !autocompletionExtension) {
      return;
    }
    viewRef.current.dispatch({
      effects: autocompletionCompartment.current.reconfigure(autocompletionExtension),
    });
  }, [autocompletionExtension]);

  return (
    <div className={cx(styles.container, className)}>
      <div className={styles.input} ref={containerRef} />
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
