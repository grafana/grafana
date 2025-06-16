import { ComponentType } from 'react';

import { promQueryModeller } from '../shared/modeller_instance';
import { QueryBuilderOperationParamEditorProps } from '../shared/types';
import { PromQueryModellerInterface } from '../types';

import { LabelParamEditor } from './LabelParamEditor';

/**
 * Maps string keys to editor components with the modeller instance injected.
 *
 * This wrapper is a key part of avoiding circular dependencies:
 * - Operation definitions reference editors by string key (no import)
 * - The registry maps these keys to editor components
 * - This wrapper injects the modeller instance into those components
 *
 * This creates a clear one-way dependency flow:
 * Operation Definitions -> Registry -> Editor Components <- Wrapper <- Modeller Instance
 *
 * Without this wrapper, we would have a circular dependency:
 * Operation Definitions -> Editors -> Modeller -> Operation Definitions
 */
const editorMap: Record<
  string,
  ComponentType<QueryBuilderOperationParamEditorProps & { queryModeller: PromQueryModellerInterface }>
> = {
  LabelParamEditor: (props) => <LabelParamEditor {...props} queryModeller={promQueryModeller} />,
};

/**
 * Wrapper component that resolves and renders the appropriate editor component.
 *
 * This component:
 * 1. Takes a parameter definition that may specify an editor by string key or direct reference
 * 2. Resolves the editor component from the map if a string key is used
 * 3. Renders the editor with all necessary props, including the modeller instance
 *
 * This separation of concerns allows operation definitions to be simpler while ensuring
 * editors have access to all the dependencies they need, without creating circular dependencies.
 */
export function OperationParamEditorWrapper(props: QueryBuilderOperationParamEditorProps) {
  const { paramDef } = props;
  const EditorComponent = typeof paramDef.editor === 'string' ? editorMap[paramDef.editor] : paramDef.editor;

  if (!EditorComponent) {
    return null;
  }

  // Type assertion is safe here because we know the editorMap only contains components
  // that require the modeller instance
  return <EditorComponent {...props} queryModeller={promQueryModeller} />;
}
