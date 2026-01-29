import { standardTransformersRegistry } from '@grafana/data';
import { DataTransformerConfig } from '@grafana/schema';
import { Text } from '@grafana/ui';

import { QueryEditorType } from '../../constants';
import { useQueryEditorUIContext } from '../QueryEditorContext';

import { SidebarCard } from './SidebarCard';

export const TransformationCard = ({ transformation }: { transformation: DataTransformerConfig }) => {
  const { selectedTransformation, setSelectedTransformation } = useQueryEditorUIContext();
  const isSelected = selectedTransformation?.id === transformation.id;
  const transformationName = standardTransformersRegistry.getIfExists(transformation.id)?.name || transformation.id;

  const handleClick = () => {
    if (!isSelected) {
      setSelectedTransformation(transformation);
    }
  };

  return (
    <SidebarCard
      editorType={QueryEditorType.Transformation}
      isSelected={isSelected}
      hasError={false}
      id={transformation.id}
      onClick={handleClick}
    >
      <Text weight="light" variant="body" color="secondary">
        {transformationName}
      </Text>
    </SidebarCard>
  );
};
