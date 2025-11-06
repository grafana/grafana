import { css } from '@emotion/css';
import { useState, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Stack,
  Tab,
  TabsBar,
  TabContent,
  Icon,
  Badge,
  Text,
  useStyles2,
  InteractiveTable,
  ScrollContainer,
  Alert,
  Spinner,
} from '@grafana/ui';

import { SQLSchemas, SQLSchemaField, SQLSchemaData } from '../hooks/useSQLSchemas';

import { getFieldTypeIcon } from './utils';

type SchemaField = SQLSchemaField;
type SampleValue = string | number | boolean;
type SampleRow = SampleValue[];
type SampleRows = SampleRow[];
type SchemaData = SQLSchemaData;

interface SchemaInspectorPanelProps {
  className?: string;
  schemas: SQLSchemas | null;
  loading: boolean;
  error: Error | null;
}

export const SchemaInspectorPanel = ({ className, schemas, loading, error }: SchemaInspectorPanelProps) => {
  const styles = useStyles2(getStyles);

  const schemaResponse: SQLSchemas = schemas ?? {};
  const refIds = Object.keys(schemaResponse);

  const [selectedTab, setSelectedTab] = useState<string>('');
  const activeSchemaTab = refIds.includes(selectedTab) ? selectedTab : refIds[0] || '';
  const activeSchemaData = schemaResponse[activeSchemaTab];

  const renderSchemaFields = (fields: SchemaField[], sampleRows: SampleRows | null) => {
    // Enhance fields with fieldIndex and sampleRows for the Sample column
    const enhancedFields = fields.map((field, index) => ({
      ...field,
      fieldIndex: index,
      sampleRows,
    }));

    return (
      <div className={styles.tableContainer}>
        <InteractiveTable
          columns={columns}
          data={enhancedFields}
          getRowId={({ name }) => name}
          pageSize={0} // No pagination
        />
      </div>
    );
  };

  const renderSchemaTabContent = ({ columns, error, sampleRows }: SchemaData) => {
    if (error) {
      return (
        <div className={styles.responseContainer}>
          <Badge text={error} color="red" icon="exclamation-triangle" />
        </div>
      );
    }

    if (!columns || columns.length === 0) {
      return (
        <div className={styles.responseContainer}>
          <Icon name="database" />
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="expressions.sql-schema.no-fields-desc">No schema information available</Trans>
          </Text>
        </div>
      );
    }

    return renderSchemaFields(columns, sampleRows);
  };

  const columns = useMemo(
    () => [
      {
        id: 'field',
        header: 'Field',
        accessorKey: 'name',
        cell: ({ row }: { row: { original: SchemaField } }) => (
          <Stack direction="row" alignItems="center" gap={1}>
            <Icon name={getFieldTypeIcon(row.original.mysqlType)} />
            <div className={styles.tableCell}>{row.original.name}</div>
          </Stack>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        accessorKey: 'mysqlType',
        cell: ({ row }: { row: { original: SchemaField } }) => <Badge text={row.original.mysqlType} color="blue" />,
      },
      {
        id: 'nullable',
        header: 'Nullable',
        accessorKey: 'nullable',
        cell: ({ row }: { row: { original: SchemaField } }) => (
          <Icon
            name={row.original.nullable ? 'check' : 'times'}
            className={row.original.nullable ? styles.nullableIcon : styles.requiredIcon}
          />
        ),
      },
      {
        id: 'sample',
        header: 'Sample values',
        accessorKey: 'sample',
        cell: ({
          row,
        }: {
          row: {
            original: SchemaField & {
              fieldIndex: number;
              sampleRows: SchemaData['sampleRows'];
            };
          };
        }) => {
          const { fieldIndex, sampleRows } = row.original;

          // Extract sample values for this field (column index)
          const sampleValues = sampleRows?.map((row) => row[fieldIndex]) ?? [];

          // Format as a proper array string with quoted strings
          const arrayString = JSON.stringify(sampleValues);

          return <div className={styles.tableCell}>{arrayString}</div>;
        },
      },
    ],
    // We don't need to memoize the styles because they are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (error) {
    return (
      <div className={styles.schemaInfoContainer}>
        <Alert title={t('expressions.sql-schema.error-title', 'Error')} severity="error">
          {error.message}
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.schemaInfoContainer}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Spinner />
          <Text variant="code" color="secondary">
            <Trans i18nKey="expressions.sql-schema.loading">Loading schema information...</Trans>
          </Text>
        </Stack>
      </div>
    );
  }

  if (!activeSchemaData || refIds.length === 0) {
    return (
      <div className={styles.schemaInfoContainer}>
        <Alert
          severity="warning"
          title={t('expressions.sql-schema.no-data-title', 'No schema information available')}
        />
      </div>
    );
  }

  return (
    // Have to use div instead of Stack because Stack doesn't support className
    <div className={`${styles.schemaInspector} ${className || ''}`}>
      <TabsBar className={styles.tabsBar}>
        {refIds.map((refId) => (
          <Tab key={refId} label={refId} active={activeSchemaTab === refId} onChangeTab={() => setSelectedTab(refId)} />
        ))}
      </TabsBar>
      <ScrollContainer backgroundColor="primary">
        <TabContent>{renderSchemaTabContent(activeSchemaData)}</TabContent>
      </ScrollContainer>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  schemaInfoContainer: css({
    padding: theme.spacing(1),
  }),
  schemaInspector: css({
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  }),
  tabsBar: css({
    flexShrink: 0,
  }),
  tableCell: css({
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    fontFamily: theme.typography.fontFamilyMonospace,
  }),
  tableContainer: css({
    margin: theme.spacing(1),
    flex: 1,
    overflowY: 'auto',
    overflowX: 'auto',
    minHeight: 0, // Allow flex child to shrink
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.background.primary,
  }),
  nullableIcon: css({
    color: theme.colors.success.text,
  }),
  requiredIcon: css({
    color: theme.colors.warning.text,
  }),
  responseContainer: css({
    padding: theme.spacing(2),
  }),
});
