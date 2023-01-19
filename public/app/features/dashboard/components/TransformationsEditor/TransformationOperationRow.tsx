import React, { useCallback } from 'react';
import { useToggle } from 'react-use';

import { DataFrame, DataTransformerConfig, TransformerRegistryItem, FrameMatcherID } from '@grafana/data';
import { HorizontalGroup } from '@grafana/ui';
import { OperationRowHelp } from 'app/core/components/QueryOperationRow/OperationRowHelp';
import { QueryOperationAction } from 'app/core/components/QueryOperationRow/QueryOperationAction';
import {
  QueryOperationRow,
  QueryOperationRowRenderProps,
} from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { PluginStateInfo } from 'app/features/plugins/components/PluginStateInfo';

import { TransformationEditor } from './TransformationEditor';
import { TransformationFilter } from './TransformationFilter';
import { TransformationsEditorTransformation } from './types';

interface TransformationOperationRowProps {
  id: string;
  index: number;
  data: DataFrame[];
  uiConfig: TransformerRegistryItem<any>;
  configs: TransformationsEditorTransformation[];
  onRemove: (index: number) => void;
  onChange: (index: number, config: DataTransformerConfig) => void;
}

export const TransformationOperationRow = ({
  onRemove,
  index,
  id,
  data,
  configs,
  uiConfig,
  onChange,
}: TransformationOperationRowProps) => {
  const [showDebug, toggleDebug] = useToggle(false);
  const [showHelp, toggleHelp] = useToggle(false);
  const disabled = configs[index].transformation.disabled;
  const filter = configs[index].transformation.filter != null;
  const showFilter = filter || data.length > 1;

  const onDisableToggle = useCallback(
    (index: number) => {
      const current = configs[index].transformation;
      onChange(index, {
        ...current,
        disabled: current.disabled ? undefined : true,
      });
    },
    [onChange, configs]
  );

  // Adds or removes the frame filter
  const toggleFilter = useCallback(() => {
    let current = { ...configs[index].transformation };
    if (current.filter) {
      delete current.filter;
    } else {
      current.filter = {
        id: FrameMatcherID.byRefId,
        options: '', // empty string will not do anything
      };
    }
    onChange(index, current);
  }, [onChange, index, configs]);

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
        {showFilter && <QueryOperationAction title="Filter" icon="filter" onClick={toggleFilter} active={filter} />}
        <QueryOperationAction title="Debug" disabled={!isOpen} icon="bug" onClick={toggleDebug} active={showDebug} />
        <QueryOperationAction
          title="Disable/Enable transformation"
          icon={disabled ? 'eye-slash' : 'eye'}
          onClick={() => onDisableToggle(index)}
          active={disabled}
        />
        <QueryOperationAction title="Remove" icon="trash-alt" onClick={() => onRemove(index)} />
      </HorizontalGroup>
    );
  };

  return (
    <QueryOperationRow
      id={id}
      index={index}
      title={uiConfig.name}
      draggable
      actions={renderActions}
      disabled={disabled}
    >
      {showHelp && <OperationRowHelp markdown={prepMarkdown(uiConfig)} />}
      {filter && (
        <TransformationFilter index={index} config={configs[index].transformation} data={data} onChange={onChange} />
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

function prepMarkdown(uiConfig: TransformerRegistryItem<any>) {
  let helpMarkdown = uiConfig.help ?? uiConfig.description;

  return `
${helpMarkdown}

Go the <a href="https://grafana.com/docs/grafana/latest/panels/transformations/?utm_source=grafana" target="_blank" rel="noreferrer">
transformation documentation
</a> for more.
`;
}
