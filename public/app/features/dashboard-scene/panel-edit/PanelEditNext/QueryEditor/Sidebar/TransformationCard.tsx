import { Text } from '@grafana/ui';

import { QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../../constants';
import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';
import { Transformation } from '../types';

import { SidebarCard } from './SidebarCard';

export const TransformationCard = ({ transformation }: { transformation: Transformation }) => {
  const { selectedTransformation, setSelectedTransformation } = useQueryEditorUIContext();
  const { deleteTransformation, toggleTransformationDisabled } = useActionsContext();
  const isSelected = selectedTransformation?.transformId === transformation.transformId;
  const transformationName = transformation.registryItem?.name || transformation.transformConfig.id;

  return (
    <SidebarCard
      config={QUERY_EDITOR_TYPE_CONFIG[QueryEditorType.Transformation]}
      isSelected={isSelected}
      id={transformation.transformId}
      onClick={() => setSelectedTransformation(transformation)}
      onDelete={() => deleteTransformation(transformation.transformId)}
      onToggleHide={() => toggleTransformationDisabled(transformation.transformId)}
      isHidden={!!transformation.transformConfig.disabled}
    >
      <Text weight="light" variant="code" color="secondary">
        {transformationName}
      </Text>
    </SidebarCard>
  );
};
