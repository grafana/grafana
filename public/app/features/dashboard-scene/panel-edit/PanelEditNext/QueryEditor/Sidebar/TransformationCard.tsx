import { Text } from '@grafana/ui';

import { QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../../constants';
import { useQueryEditorUIContext } from '../QueryEditorContext';
import { Transformation } from '../types';

import { SidebarCard } from './SidebarCard';

export const TransformationCard = ({ transformation }: { transformation: Transformation }) => {
  const { selectedTransformation, setSelectedTransformation } = useQueryEditorUIContext();
  const isSelected = selectedTransformation?.transformId === transformation.transformId;
  const transformationName = transformation.registryItem?.name || transformation.transformId;

  return (
    <SidebarCard
      config={QUERY_EDITOR_TYPE_CONFIG[QueryEditorType.Transformation]}
      isSelected={isSelected}
      hasError={false}
      id={transformation.transformId}
      onClick={() => setSelectedTransformation(transformation)}
    >
      <Text weight="light" variant="body" color="secondary">
        {transformationName}
      </Text>
    </SidebarCard>
  );
};
