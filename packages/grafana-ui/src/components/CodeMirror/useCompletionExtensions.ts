import { autocompletion, startCompletion } from '@codemirror/autocomplete';
import { EditorState, Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { useMemo } from 'react';

import { type BaseCodeEditorProps, type CodeMirrorExtension } from './types';
import { useShallowStable } from './useStableProps';
import { createVariableCompletionSource } from './variableCompletion';

type CompletionProps = Pick<
  BaseCodeEditorProps,
  'completionSources' | 'completionMode' | 'completeOnSpace' | 'variableSuggestions' | 'variableCompletionOptions'
>;

const autocompleteSpaceKeymap = Prec.highest(
  keymap.of([
    {
      key: 'Space',
      run: (view) => {
        if (view.state.readOnly) {
          return false;
        }

        view.dispatch(view.state.replaceSelection(' '));
        startCompletion(view);
        return true;
      },
    },
  ])
);

export function useCompletionExtensions({
  completionSources,
  completionMode = 'merge',
  completeOnSpace = false,
  variableSuggestions: variableSuggestionsProp,
  variableCompletionOptions: variableCompletionOptionsProp,
}: CompletionProps): CodeMirrorExtension[] {
  const sources = useShallowStable(completionSources);
  const variableSuggestions = useShallowStable(variableSuggestionsProp);
  const variableCompletionOptions = useShallowStable(variableCompletionOptionsProp);
  const allSources = useMemo(
    () => [
      ...(sources ?? []),
      ...(variableSuggestions?.length
        ? [createVariableCompletionSource(variableSuggestions, variableCompletionOptions)]
        : []),
    ],
    [sources, variableSuggestions, variableCompletionOptions]
  );

  return useMemo(() => {
    if (allSources.length === 0) {
      return [];
    }

    const spaceKeymap = completeOnSpace ? [autocompleteSpaceKeymap] : [];

    if (completionMode === 'override') {
      return [autocompletion({ override: [...allSources] }), ...spaceKeymap];
    }

    // Language data combines these sources with the active language's completions.
    return [
      autocompletion(),
      ...spaceKeymap,
      ...allSources.map((source) => EditorState.languageData.of(() => [{ autocomplete: source }])),
    ];
  }, [allSources, completionMode, completeOnSpace]);
}
