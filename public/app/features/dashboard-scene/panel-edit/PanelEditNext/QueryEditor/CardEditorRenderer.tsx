import { QueryEditorType } from '../constants';

import { AlertEditorRenderer } from './AlertEditorRenderer';
import { ExpressionTypePicker } from './Body/ExpressionTypePicker';
import { TransformationTypePicker } from './Body/TransformationTypePicker';
import { useQueryEditorUIContext } from './QueryEditorContext';
import { QueryEditorRenderer } from './QueryEditorRenderer';
import { TransformationEditorRenderer } from './TransformationEditorRenderer';

export function CardEditorRenderer() {
  const { cardType, pendingExpression, pendingTransformation } = useQueryEditorUIContext();

  if (pendingExpression) {
    return <ExpressionTypePicker />;
  }

  if (pendingTransformation) {
    return <TransformationTypePicker />;
  }

  if (cardType === QueryEditorType.Alert) {
    return <AlertEditorRenderer />;
  }

  if (cardType === QueryEditorType.Transformation) {
    return <TransformationEditorRenderer />;
  }

  return <QueryEditorRenderer />;
}
