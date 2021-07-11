import React from 'react';
import { DataFrame, DataTransformerConfig, renderMarkdown, TransformerRegistryItem } from '@grafana/data';
import { Alert, HorizontalGroup } from '@grafana/ui';

import { TransformationEditor } from './TransformationEditor';
import {
  QueryOperationRow,
  QueryOperationRowRenderProps,
} from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { QueryOperationAction } from 'app/core/components/QueryOperationRow/QueryOperationAction';
import { TransformationsEditorTransformation } from './types';
import { PluginStateInfo } from 'app/features/plugins/PluginStateInfo';
import { useToggle } from 'react-use';

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
        {uiConfig.help && (
          <QueryOperationAction title="Show/hide transform help guide" icon="info-circle" onClick={toggleHelp} />
        )}
        <QueryOperationAction title="Debug" disabled={!isOpen} icon="bug" onClick={toggleDebug} />
        <QueryOperationAction title="Remove" icon="trash-alt" onClick={() => onRemove(index)} />
      </HorizontalGroup>
    );
  };

  return (
    <QueryOperationRow id={id} index={index} title={uiConfig.name} draggable actions={renderActions}>
      {showHelp && (
        <Alert title="Help" onRemove={toggleHelp}>
          {renderHelp(uiConfig.help!)}
        </Alert>
      )}
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

function renderHelp(help: string) {
  const helpHtml = renderMarkdown(help);
  return <div className="markdown-html" dangerouslySetInnerHTML={{ __html: helpHtml }} />;
}
