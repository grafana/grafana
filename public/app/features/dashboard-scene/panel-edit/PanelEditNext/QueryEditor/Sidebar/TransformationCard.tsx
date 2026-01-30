import { standardTransformersRegistry } from '@grafana/data';
import { DataTransformerConfig } from '@grafana/schema';
import { Text } from '@grafana/ui';

import { QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../../constants';
import { useQueryEditorUIContext } from '../QueryEditorContext';

import { SidebarCard } from './SidebarCard';

export const TransformationCard = ({ transformation }: { transformation: DataTransformerConfig }) => {
  const { selectedTransformation, setSelectedTransformation } = useQueryEditorUIContext();
  const isSelected = selectedTransformation?.id === transformation.id;
  const transformationName = standardTransformersRegistry.getIfExists(transformation.id)?.name || transformation.id;

  return (
    <SidebarCard
      config={QUERY_EDITOR_TYPE_CONFIG[QueryEditorType.Transformation]}
      isSelected={isSelected}
      hasError={false}
      id={transformation.id}
      onClick={() => setSelectedTransformation(transformation)}
    >
      <Text weight="light" variant="body" color="secondary">
        {transformationName}
      </Text>
    </SidebarCard>
  );
};
