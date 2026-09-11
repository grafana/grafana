import { Icon } from '@grafana/ui';

import { transformationToActionItem } from '../../../actionItem';
import { PENDING_CARD_ID, QueryEditorType } from '../../../constants';
import { useActionsContext, useQueryEditorUIContext, useQueryEditorTypeConfig } from '../../QueryEditorContext';
import { type Transformation } from '../../types';

import { CardTitle } from './CardTitle';
import { GhostSidebarCard } from './GhostSidebarCard';
import { SidebarCard } from './SidebarCard';

export const TransformationCard = ({ transformation }: { transformation: Transformation }) => {
  const {
    selectedTransformation,
    setSelectedTransformation,
    toggleTransformationSelection,
    selectedTransformationIds,
    multiSelectMode,
    pendingTransformation,
  } = useQueryEditorUIContext();
  const { deleteTransformation, toggleTransformationDisabled } = useActionsContext();
  const typeConfig = useQueryEditorTypeConfig();
  const isSelected = selectedTransformation?.transformId === transformation.transformId;
  const isMultiSelected = multiSelectMode && selectedTransformationIds.includes(transformation.transformId);
  const isHidden = !!transformation.transformConfig.disabled;
  const transformationName = transformation.registryItem?.name || transformation.transformConfig.id;

  const item = transformationToActionItem(transformation);

  return (
    <>
      <SidebarCard
        isSelected={isSelected}
        isMultiSelected={isMultiSelected}
        id={transformation.transformId}
        item={item}
        onSelect={() => setSelectedTransformation(transformation)}
        onToggleMultiSelect={(modifiers) => toggleTransformationSelection(transformation, modifiers)}
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
