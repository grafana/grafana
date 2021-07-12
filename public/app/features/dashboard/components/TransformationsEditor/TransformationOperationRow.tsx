import React from 'react';
import { DataFrame, DataTransformerConfig, TransformerRegistryItem } from '@grafana/data';
import { HorizontalGroup } from '@grafana/ui';

import { TransformationEditor } from './TransformationEditor';
import {
  QueryOperationRow,
  QueryOperationRowRenderProps,
} from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { QueryOperationAction } from 'app/core/components/QueryOperationRow/QueryOperationAction';
import { TransformationsEditorTransformation } from './types';
import { PluginStateInfo } from 'app/features/plugins/PluginStateInfo';
import { useToggle } from 'react-use';
import { OperationRowHelp } from 'app/core/components/QueryOperationRow/OperationRowHelp';

interface TransformationOperationRowProps {
  id: string;
  index: number;
  data: DataFrame[];
  uiConfig: TransformerRegistryItem<any>;
  configs: TransformationsEditorTransformation[];
  onRemove: (index: number) => void;
  onChange: (index: number, config: DataTransformerConfig) => void;
}

export const TransformationOperationRow: React.FC<TransformationOperationRowProps> = ({
  onRemove,
  index,
  id,
  data,
  configs,
  uiConfig,
  onChange,
}) => {
  const [showDebug, toggleDebug] = useToggle(false);
  const [showHelp, toggleHelp] = useToggle(false);

  const renderActions = ({ isOpen }: QueryOperationRowRenderProps) => {
    return (
      <HorizontalGroup align="center" width="auto">
        {uiConfig.state && <PluginStateInfo state={uiConfig.state} />}
        <QueryOperationAction
          title="Show/hide transform help"
          icon="info-circle"
          onClick={toggleHelp}
          active={showHelp}
        />
        <QueryOperationAction title="Debug" disabled={!isOpen} icon="bug" onClick={toggleDebug} active={showDebug} />
        <QueryOperationAction title="Remove" icon="trash-alt" onClick={() => onRemove(index)} />
      </HorizontalGroup>
    );
  };

  return (
    <QueryOperationRow id={id} index={index} title={uiConfig.name} draggable actions={renderActions}>
      {showHelp && <OperationRowHelp markdown={prepMarkdown(uiConfig)} />}
      <TransformationEditor
        debugMode={showDebug}
        index={index}
        data={data}
        configs={configs}
        uiConfig={uiConfig}
        onChange={onChange}
      />
    </QueryOperationRow>
  );
};

function prepMarkdown(uiConfig: TransformerRegistryItem<any>) {
  let helpMarkdown = uiConfig.help ?? uiConfig.description;

  return `
${helpMarkdown}

<a href="https://grafana.com/docs/grafana/latest/panels/transformations/?utm_source=grafana" target="_blank" rel="noreferrer">
Read more on the documentation site
</a>
`;
}
