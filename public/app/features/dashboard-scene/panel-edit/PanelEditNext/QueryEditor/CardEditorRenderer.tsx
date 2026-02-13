import { QueryEditorType } from '../constants';

import { useQueryEditorUIContext } from './QueryEditorContext';
import { QueryEditorRenderer } from './QueryEditorRenderer';
import { TransformationEditorRenderer } from './TransformationEditorRenderer';

export function CardEditorRenderer() {
  const { cardType } = useQueryEditorUIContext();

  if (cardType === QueryEditorType.Transformation) {
    return <TransformationEditorRenderer />;
  }

  return <QueryEditorRenderer />;
}
