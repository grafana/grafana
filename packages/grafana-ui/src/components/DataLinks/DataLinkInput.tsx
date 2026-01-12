import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
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
import { css } from '@emotion/css';
import { memo, useEffect, useRef } from 'react';

import { GrafanaTheme2, VariableSuggestion } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { getInputStyles } from '../Input/Input';

import { createDataLinkHighlighter, createDataLinkTheme, dataLinkAutocompletion } from './codemirrorUtils';

interface DataLinkInputProps {
  value: string;
  onChange: (url: string, callback?: () => void) => void;
  suggestions: VariableSuggestion[];
  placeholder?: string;
}

export const DataLinkInput = memo(
  ({
    value,
    onChange,
    suggestions,
    placeholder = 'http://your-grafana.com/d/000000010/annotations',
  }: DataLinkInputProps) => {
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const editorViewRef = useRef<EditorView | null>(null);
    const styles = useStyles2(getStyles);
    const theme = useTheme2();
    const themeCompartment = useRef(new Compartment());
    const suggestionsCompartment = useRef(new Compartment());

    const customKeymap = keymap.of([...closeBracketsKeymap, ...completionKeymap, ...historyKeymap, ...defaultKeymap]);

    // Initialize CodeMirror editor
    useEffect(() => {
      if (!editorContainerRef.current || editorViewRef.current) {
        return;
      }

      const startState = EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightSpecialChars(),
          history(),
          foldGutter(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          rectangularSelection(),
          customKeymap,
          placeholderExtension(placeholder),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update: ViewUpdate) => {
            if (update.docChanged) {
              const newValue = update.state.doc.toString();
              onChange(newValue);
            }
          }),
          tooltips({
            parent: document.body, // Render tooltips at body level to prevent clipping by modals
          }),
          themeCompartment.current.of([createDataLinkTheme(theme), createDataLinkHighlighter(theme)]),
          suggestionsCompartment.current.of(
            autocompletion({
              override: [dataLinkAutocompletion(suggestions)],
              activateOnTyping: true,
              closeOnBlur: true,
              maxRenderedOptions: 100,
              defaultKeymap: true,
              interactionDelay: 0,
            })
          ),
          EditorState.phrases.of({
            next: 'Next',
            previous: 'Previous',
            Completions: 'Completions',
          }),
          EditorView.editorAttributes.of({ 'aria-label': placeholder }),
        ],
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
          effects: themeCompartment.current.reconfigure([createDataLinkTheme(theme), createDataLinkHighlighter(theme)]),
        });
      }
    }, [theme]);

    // Update suggestions when they change
    useEffect(() => {
      if (editorViewRef.current) {
        editorViewRef.current.dispatch({
          effects: suggestionsCompartment.current.reconfigure(
            autocompletion({
              override: [dataLinkAutocompletion(suggestions)],
              activateOnTyping: true,
              closeOnBlur: true,
              maxRenderedOptions: 100,
              defaultKeymap: true,
              interactionDelay: 0,
            })
          ),
        });
      }
    }, [suggestions]);

    return (
      <div className={styles.container}>
        <div className={styles.input} ref={editorContainerRef} />
      </div>
    );
  }
);

DataLinkInput.displayName = 'DataLinkInput';

const getStyles = (theme: GrafanaTheme2) => {
  const baseInputStyles = getInputStyles({ theme, invalid: false }).input;

  return {
    container: css({
      position: 'relative',
      width: '100%',
    }),
    input: css(baseInputStyles),
  };
};
