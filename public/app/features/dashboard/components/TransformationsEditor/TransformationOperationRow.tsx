import React, { ComponentType, useEffect, useMemo, useState } from 'react';
import { mergeMap } from 'rxjs/operators';
import { DataFrame, DataTransformerConfig, transformDataFrame, TransformerUIProps } from '@grafana/data';
import { HorizontalGroup } from '@grafana/ui';

import { TransformationEditor } from './TransformationEditor';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import { QueryOperationAction } from 'app/core/components/QueryOperationRow/QueryOperationAction';

interface TransformationsEditorTransformation {
  transformation: DataTransformerConfig;
  id: string;
}

interface TransformationOperationRowProps {
  id: string;
  index: number;
  name: string;
  description?: string;
  options: any;
  editor: ComponentType<TransformerUIProps<any>>;
  data: DataFrame[];
  transformations: TransformationsEditorTransformation[];
  onRemove: (index: number) => void;
  onChange: (index: number, config: DataTransformerConfig) => void;
}

export const TransformationOperationRow: React.FC<TransformationOperationRowProps> = ({
  children,
  name,
  onRemove,
  index,
  id,
  data,
  transformations,
  editor,
  description,
  options,
  onChange,
}) => {
  const [showDebug, setShowDebug] = useState(false);
  const [input, setInput] = useState<DataFrame[]>([]);
  const [output, setOutput] = useState<DataFrame[]>([]);
  const config = useMemo(() => transformations[index], [transformations]);

  useEffect(() => {
    const inputTransforms = transformations.slice(0, index).map(t => t.transformation);
    const outputTransforms = transformations.slice(index).map(t => t.transformation);
    const inputSubscription = transformDataFrame(inputTransforms, data).subscribe(setInput);
    const outputSubscription = transformDataFrame(inputTransforms, data)
      .pipe(mergeMap(before => transformDataFrame(outputTransforms, before)))
      .subscribe(setOutput);

    return function unsubscribe() {
      inputSubscription.unsubscribe();
      outputSubscription.unsubscribe();
    };
  }, [index, data, transformations]);

  const transformEditor = useMemo(
    () =>
      React.createElement(editor, {
        options,
        input,
        onChange: (options: any) => {
          onChange(index, { id: config.transformation.id, options });
        },
      }),
    [editor, options, input, onChange]
  );

  const renderActions = ({ isOpen }: { isOpen: boolean }) => {
    return (
      <HorizontalGroup align="center">
        <QueryOperationAction
          title="Debug"
          disabled={!isOpen}
          icon="bug"
          onClick={() => {
            setShowDebug(!showDebug);
          }}
        />

        <QueryOperationAction title="Remove" icon="trash-alt" onClick={() => onRemove(index)} />
      </HorizontalGroup>
    );
  };

  return (
    <QueryOperationRow id={id} index={index} title={name} draggable actions={renderActions}>
      <TransformationEditor
        debugMode={showDebug}
        input={input}
        name={name}
        editor={transformEditor}
        description={description}
        output={output}
      />
    </QueryOperationRow>
  );
};
