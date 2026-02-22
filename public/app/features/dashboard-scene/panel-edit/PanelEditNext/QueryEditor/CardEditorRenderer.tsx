import { ExpressionQueryType } from 'app/features/expressions/types';

import { EmptyTransformationsMessage } from '../../PanelDataPane/EmptyTransformationsMessage';
import { QueryEditorType } from '../constants';

import { AlertEditorRenderer } from './AlertEditorRenderer';
import { ExpressionTypePicker } from './Body/ExpressionTypePicker';
import { TransformationTypePicker } from './Body/TransformationTypePicker';
import {
  useDatasourceContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
} from './QueryEditorContext';
import { QueryEditorRenderer } from './QueryEditorRenderer';
import { TransformationEditorRenderer } from './TransformationEditorRenderer';

export function CardEditorRenderer() {
  const {
    cardType,
    pendingExpression,
    pendingTransformation,
    setPendingTransformation,
    finalizePendingTransformation,
    finalizePendingExpression,
  } = useQueryEditorUIContext();
  const { transformations } = usePanelContext();
  const { data, queries } = useQueryRunnerContext();
  const { dsSettings } = useDatasourceContext();

  if (pendingExpression) {
    return <ExpressionTypePicker />;
  }

  if (pendingTransformation) {
    const shouldShowPicker = pendingTransformation.showPicker || transformations.length > 0;

    return shouldShowPicker ? (
      <TransformationTypePicker />
    ) : (
      <EmptyTransformationsMessage
        showHeaderText={false}
        onShowPicker={() => setPendingTransformation({ showPicker: true })}
        onAddTransformation={finalizePendingTransformation}
        onGoToQueries={() => {
          setPendingTransformation(null);
          finalizePendingExpression(ExpressionQueryType.sql);
        }}
        data={data?.series ?? []}
        datasourceUid={dsSettings?.uid}
        queries={queries}
      />
    );
  }

  if (cardType === QueryEditorType.Alert) {
    return <AlertEditorRenderer />;
  }

  if (cardType === QueryEditorType.Transformation) {
    return <TransformationEditorRenderer />;
  }

  return <QueryEditorRenderer />;
}
