import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, RadioButtonGroup, Switch, useStyles2 } from '@grafana/ui';
import Stack from 'app/plugins/datasource/cloudwatch/components/ui/Stack';
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
  const styles = useStyles2(getStyles);

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
        <Button className={styles.runQuery} variant="secondary" size="sm" fill="outline">
          Run query
        </Button>
        <Stack gap={1}>
          <label className={styles.switchLabel}>Instant</label>
          <Switch />
        </Stack>
        <Stack gap={1}>
          <label className={styles.switchLabel}>Exemplars</label>
          <Switch />
        </Stack>
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    runQuery: css({
      color: theme.colors.text.secondary,
    }),
    switchLabel: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
};
