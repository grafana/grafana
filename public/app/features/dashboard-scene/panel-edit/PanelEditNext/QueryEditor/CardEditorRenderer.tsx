import { ExpressionQueryType } from 'app/features/expressions/types';

import { EmptyTransformationsMessage } from '../../PanelDataPane/EmptyTransformationsMessage';

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
    activeContext,
    setActiveContext,
    finalizeTransformationPicker,
    finalizeExpressionPicker,
    selectedTransformation,
  } = useQueryEditorUIContext();
  const { transformations } = usePanelContext();
  const { data, queries } = useQueryRunnerContext();
  const { dsSettings } = useDatasourceContext();

  if (activeContext.view === 'data' && activeContext.selection.kind === 'expressionPicker') {
    return <ExpressionTypePicker />;
  }

  if (activeContext.view === 'data' && activeContext.selection.kind === 'transformationPicker') {
    const { insertAfter, showPicker } = activeContext.selection;
    const shouldShowPicker = showPicker || transformations.length > 0;

    return shouldShowPicker ? (
      <TransformationTypePicker />
    ) : (
      <EmptyTransformationsMessage
        showHeaderText={false}
        onShowPicker={() =>
          setActiveContext({ view: 'data', selection: { kind: 'transformationPicker', insertAfter, showPicker: true } })
        }
        onAddTransformation={finalizeTransformationPicker}
        onGoToQueries={() => {
          finalizeExpressionPicker(ExpressionQueryType.sql);
        }}
        data={data?.series ?? []}
        datasourceUid={dsSettings?.uid}
        queries={queries}
      />
    );
  }

  if (activeContext.view === 'alerts') {
    return <AlertEditorRenderer />;
  }

  if (selectedTransformation) {
    return <TransformationEditorRenderer />;
  }

  return <QueryEditorRenderer />;
}
