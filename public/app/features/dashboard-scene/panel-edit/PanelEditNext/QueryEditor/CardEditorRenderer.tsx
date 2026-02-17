import { QueryEditorType } from '../constants';

import { AlertEditorRenderer } from './AlertEditorRenderer';
import { ExpressionTypePicker } from './Body/ExpressionTypePicker';
import { useQueryEditorUIContext } from './QueryEditorContext';
import { QueryEditorRenderer } from './QueryEditorRenderer';
import { TransformationEditorRenderer } from './TransformationEditorRenderer';

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
