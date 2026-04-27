import { Icon } from '@grafana/ui';

import { PENDING_CARD_ID, QueryEditorType } from '../../../constants';
import { useActionsContext, useQueryEditorUIContext, useQueryEditorTypeConfig } from '../../QueryEditorContext';
import { type Transformation } from '../../types';

import { CardTitle } from './CardTitle';
import { GhostSidebarCard } from './GhostSidebarCard';
import { SidebarCard } from './SidebarCard';

export const TransformationCard = ({ transformation }: { transformation: Transformation }) => {
  const { selectedTransformation, toggleTransformationSelection, selectedTransformationIds, pendingTransformation } =
    useQueryEditorUIContext();
  const { deleteTransformation, toggleTransformationDisabled } = useActionsContext();
  const typeConfig = useQueryEditorTypeConfig();
  const isSelected = selectedTransformation?.transformId === transformation.transformId;
  const isPartOfSelection = selectedTransformationIds.includes(transformation.transformId) && !isSelected;
  const isHidden = !!transformation.transformConfig.disabled;
  const transformationName = transformation.registryItem?.name || transformation.transformConfig.id;

  const item = {
    name: transformationName,
    type: QueryEditorType.Transformation,
    isHidden: !!transformation.transformConfig.disabled,
  };

  return (
    <>
      <SidebarCard
        isSelected={isSelected}
        isPartOfSelection={isPartOfSelection}
        id={transformation.transformId}
        item={item}
        onSelect={(modifiers) => toggleTransformationSelection(transformation, modifiers)}
        onDelete={() => deleteTransformation(transformation.transformId)}
        onToggleHide={() => toggleTransformationDisabled(transformation.transformId)}
      >
        <Icon
          name={typeConfig[QueryEditorType.Transformation].icon}
          color={typeConfig[QueryEditorType.Transformation].color}
          size="sm"
        />
        <CardTitle title={transformationName} isHidden={isHidden} />
      </SidebarCard>
      {pendingTransformation?.insertAfter === transformation.transformId && (
        <GhostSidebarCard id={PENDING_CARD_ID.transformation} type={QueryEditorType.Transformation} />
      )}
    </>
  );
};
