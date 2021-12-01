import { RadioButtonGroup } from '@grafana/ui';
import React, { useCallback } from 'react';
import EditorHeader from '../../../cloudwatch/components/ui/EditorHeader';
import FlexItem from '../../../cloudwatch/components/ui/FlexItem';
import InlineSelect from '../../../cloudwatch/components/ui/InlineSelect';
import { Space } from '../../../cloudwatch/components/ui/Space';
import { PromQueryEditor } from '../../components/PromQueryEditor';
import { PromQueryEditorProps } from '../../components/types';
import { PromEditorMode } from '../../types';
import { PromQueryBuilder } from './PromQueryBuilder';

const editorModes = [
  { label: 'Builder', value: PromEditorMode.Builder },
  { label: 'Code', value: PromEditorMode.Code },
];

export const PromQueryEditorSelector = React.memo<PromQueryEditorProps>((props) => {
  const { query, onChange } = props;

  const onEditorModeChange = useCallback(
    (newMetricEditorMode: PromEditorMode) => {
      onChange({ ...query, editorMode: newMetricEditorMode });
    },
    [onChange, query]
  );

  const editorMode = query.editorMode ?? PromEditorMode.Code;

  return (
    <>
      <EditorHeader>
        <FlexItem grow={1} />
        <InlineSelect
          value={undefined}
          placeholder="Query patterns"
          allowCustomValue
          onChange={({ value }) => {}}
          options={[]}
        />

        <RadioButtonGroup options={editorModes} size="sm" value={editorMode} onChange={onEditorModeChange} />
      </EditorHeader>
      <Space v={0.5} />
      {editorMode === PromEditorMode.Code && <PromQueryEditor {...props} />}
      {editorMode === PromEditorMode.Builder && <PromQueryBuilder {...props} />}
    </>
  );
});

PromQueryEditorSelector.displayName = 'PromQueryEditorSelector';
