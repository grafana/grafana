import { type DataFrame } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Icon, useTheme2 } from '@grafana/ui';

import { getQueryEditorTypeConfig, QueryEditorType } from '../constants';

import { useActionsContext } from './QueryEditorContext';
import { StackedItemShell } from './StackedItemShell';
import { TransformationEditor } from './TransformationEditor';
import { useTransformationInputData } from './hooks/useTransformationInputData';
import { type Transformation } from './types';

interface StackedTransformationItemProps {
  transformation: Transformation;
  allTransformations: Transformation[];
  rawData: DataFrame[];
}

export function StackedTransformationItem({
  transformation,
  allTransformations,
  rawData,
}: StackedTransformationItemProps) {
  const { registryItem, transformConfig } = transformation;
  const { updateTransformation } = useActionsContext();
  const theme = useTheme2();

  const inputData = useTransformationInputData({
    selectedTransformation: transformation,
    allTransformations,
    rawData,
  });

  const label = t('query-editor-next.stacked-view.transformation-label', 'Transformation');
  const name = registryItem?.name ?? transformConfig.id;
  const typeConfig = getQueryEditorTypeConfig(theme)[QueryEditorType.Transformation];

  return (
    <StackedItemShell
      editorType={QueryEditorType.Transformation}
      icon={<Icon name={typeConfig.icon} color={typeConfig.color} size="sm" />}
      label={label}
      name={name}
      isHidden={transformConfig.disabled}
    >
      {registryItem?.editor ? (
        <TransformationEditor inputData={inputData} onUpdate={updateTransformation} transformation={transformation} />
      ) : (
        <Alert
          severity="error"
          title={t(
            'transformation-editor-renderer.no-transformation-editor-title',
            'Transformation does not have an editor component'
          )}
        />
      )}
    </StackedItemShell>
  );
}
