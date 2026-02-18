import { Icon } from '@grafana/ui';

import { QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../../constants';
import { useActionsContext, useQueryEditorUIContext } from '../QueryEditorContext';
import { Transformation } from '../types';

import { CardTitle } from './CardTitle';
import { SidebarCard } from './SidebarCard';

export const TransformationCard = ({ transformation }: { transformation: Transformation }) => {
  const { selectedTransformation, setSelectedTransformation } = useQueryEditorUIContext();
  const { deleteTransformation, toggleTransformationDisabled } = useActionsContext();
  const isSelected = selectedTransformation?.transformId === transformation.transformId;
  const isHidden = !!transformation.transformConfig.disabled;
  const transformationName = transformation.registryItem?.name || transformation.transformConfig.id;

  const item = {
    name: transformationName,
    type: QueryEditorType.Transformation,
    isHidden: !!transformation.transformConfig.disabled,
  };

  return (
    <SidebarCard
      isSelected={isSelected}
      id={transformation.transformId}
      item={item}
      onClick={() => setSelectedTransformation(transformation)}
      onDelete={() => deleteTransformation(transformation.transformId)}
      onToggleHide={() => toggleTransformationDisabled(transformation.transformId)}
    >
      <Icon
        name={QUERY_EDITOR_TYPE_CONFIG[QueryEditorType.Transformation].icon}
        color={QUERY_EDITOR_TYPE_CONFIG[QueryEditorType.Transformation].color}
        size="sm"
      />
      <CardTitle title={transformationName} isHidden={isHidden} />
    </SidebarCard>
  );
};
