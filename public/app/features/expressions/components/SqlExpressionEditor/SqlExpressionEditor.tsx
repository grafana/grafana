import { useCallback, useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { Drawer, Stack, Text } from '@grafana/ui';

import { ActionButtonConfig } from '../../hooks/useExpressionActions';
import { ExpressionQuery } from '../../types';
import { SqlExpr } from '../SqlExpr';

import { SqlExpressionDsCards } from './SqlExpressionDsCards';

// import { SqlExpressionEditorPreview } from './SqlExpressionEditorPreview';

interface SqlExpressionEditorProps {
  onChange: (query: ExpressionQuery) => void;
  queries?: DataQuery[];
  query: ExpressionQuery;
  refIds: Array<SelectableValue<string>>;
  setActionButton: (config: ActionButtonConfig | null) => void;
}

export const SqlExpressionEditor = ({
  onChange,
  queries,
  query,
  refIds,
  setActionButton,
}: SqlExpressionEditorProps) => {
  const [isSQLEditorOpen, setIsSQLEditorOpen] = useState(false);
  // TODO: Implement preview
  // const [previewError, setPreviewError] = useState<string | null>(null);
  // const [hasExecutedSuccessfully, setHasExecutedSuccessfully] = useState(false);

  const handleDrawerClose = useCallback(() => {
    setIsSQLEditorOpen(false);
    // setPreviewError(null);
    // setHasExecutedSuccessfully(false);
  }, []);

  // Set up the action button when component mounts
  useEffect(() => {
    setActionButton({
      label: t('expressions.expression-query-editor.open-sql-editor', 'Editor'),
      tooltip: t('expressions.expression-query-editor.open-sql-editor', 'Open SQL editor'),
      icon: 'edit',
      onClick: () => setIsSQLEditorOpen(true),
    });

    return () => setActionButton(null);
  }, [setActionButton]);

  // Reset execution state when query changes
  // TODO: Implement preview
  useEffect(() => {
    // setHasExecutedSuccessfully(false);
    // setPreviewError(null);
  }, [query.expression]);

  if (!isSQLEditorOpen) {
    return <SqlExpr onChange={onChange} query={query} refIds={refIds} />;
  }

  return (
    <Drawer
      size="lg"
      title={t('expressions.expression-query-editor.sql-editor-title', 'SQL Expression Editor')}
      onClose={handleDrawerClose}
    >
      <Stack direction="column" gap={2}>
        <SqlExpressionDsCards refIds={refIds} queries={queries} />
        {/* SQL Editor Section */}
        <Text variant="h5">{t('expressions.sql-drawer.sql-query', 'SQL Query')}</Text>
        <SqlExpr onChange={onChange} query={query} refIds={refIds} />

        {/* Results Preview Section */}
        {/* TODO: Implement preview */}
        {/* <SqlExpressionEditorPreview
          query={query}
          previewError={previewError}
          hasExecutedSuccessfully={hasExecutedSuccessfully}
        /> */}
      </Stack>
    </Drawer>
  );
};
