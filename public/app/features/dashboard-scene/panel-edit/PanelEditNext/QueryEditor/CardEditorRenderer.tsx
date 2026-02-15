import { QueryEditorType } from '../constants';

import { AlertEditorRenderer } from './AlertEditorRenderer';
import { ExpressionTypePicker } from './Body/ExpressionTypePicker';
import { useQueryEditorUIContext } from './QueryEditorContext';
import { QueryEditorRenderer } from './QueryEditorRenderer';
import { TransformationEditorRenderer } from './TransformationEditorRenderer';

/**
 * Main content renderer that switches between different editor types based on the current selection.
 * Renders the appropriate editor for queries, expressions, transformations, or alerts.
 *
 * @returns The appropriate editor component based on current UI state
 */
export function CardEditorRenderer() {
  const { cardType, pendingExpression } = useQueryEditorUIContext();

  if (pendingExpression) {
    return <ExpressionTypePicker />;
  }

  if (cardType === QueryEditorType.Alert) {
    return <AlertEditorRenderer />;
  }

  if (cardType === QueryEditorType.Transformation) {
    return <TransformationEditorRenderer />;
  }

  return <QueryEditorRenderer />;
}
