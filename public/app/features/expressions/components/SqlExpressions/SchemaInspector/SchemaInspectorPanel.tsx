import { css } from '@emotion/css';
import { useState, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
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
} from '@grafana/ui';

import { getFieldTypeIcon } from './utils';

const testData = {
  kind: 'SQLSchemaResponse',
  apiVersion: 'query.grafana.app/v0alpha1',
  SQLSchema: {
    query_name_a: {
      columns: [
        {
          name: '__metric_name__',
          mysqlType: 'text',
          nullable: false,
          dataFrameFieldType: 'string',
        },
        {
          name: '__value__',
          mysqlType: 'double',
          nullable: true,
          dataFrameFieldType: '*float64',
        },
        {
          name: 'host',
          mysqlType: 'text',
          nullable: true,
          dataFrameFieldType: '*string',
        },
      ],
      sampleRows: [
        ['cpu', 3.14, 'a'],
        ['cpu', 93.14, 'b'],
        ['cpu', 3, 'x'],
      ],
    },
    query_name_b: {
      columns: [
        {
          name: 'timestamp',
          mysqlType: 'datetime',
          nullable: false,
          dataFrameFieldType: 'time',
        },
        {
          name: 'service_name',
          mysqlType: 'text',
          nullable: false,
          dataFrameFieldType: 'string',
        },
        {
          name: 'request_count',
          mysqlType: 'int',
          nullable: false,
          dataFrameFieldType: 'int64',
        },
        {
          name: 'response_time_ms',
          mysqlType: 'double',
          nullable: true,
          dataFrameFieldType: '*float64',
        },
        {
          name: 'error_rate',
          mysqlType: 'float',
          nullable: true,
          dataFrameFieldType: '*float32',
        },
        {
          name: 'status_code',
          mysqlType: 'int',
          nullable: true,
          dataFrameFieldType: '*int32',
        },
        {
          name: 'user_id',
          mysqlType: 'bigint',
          nullable: true,
          dataFrameFieldType: '*int64',
        },
        {
          name: 'endpoint',
          mysqlType: 'text',
          nullable: false,
          dataFrameFieldType: 'string',
        },
        {
          name: 'method',
          mysqlType: 'text',
          nullable: false,
          dataFrameFieldType: 'string',
        },
        {
          name: 'is_success',
          mysqlType: 'boolean',
          nullable: false,
          dataFrameFieldType: 'bool',
        },
        {
          name: 'bytes_sent',
          mysqlType: 'bigint',
          nullable: true,
          dataFrameFieldType: '*int64',
        },
        {
          name: 'region',
          mysqlType: 'text',
          nullable: true,
          dataFrameFieldType: '*string',
        },
        {
          name: 'trace_id',
          mysqlType: 'text',
          nullable: true,
          dataFrameFieldType: '*string',
        },
        {
          name: 'created_at',
          mysqlType: 'timestamp',
          nullable: false,
          dataFrameFieldType: 'time',
        },
        {
          name: 'cpu_usage',
          mysqlType: 'float',
          nullable: true,
          dataFrameFieldType: '*float32',
        },
      ],
      sampleRows: [
        [
          '2023-01-01 12:00:00',
          'auth-service',
          150,
          23.4,
          0.05,
          200,
          12345,
          '/api/login',
          'POST',
          true,
          2048,
          'us-east-1',
          'abc123',
          '2023-01-01 12:00:01',
          45.2,
        ],
        [
          '2023-01-01 12:01:00',
          'user-service',
          89,
          45.7,
          0.12,
          201,
          67890,
          '/api/users',
          'GET',
          true,
          1024,
          'us-west-2',
          'def456',
          '2023-01-01 12:01:01',
          32.8,
        ],
        [
          '2023-01-01 12:02:00',
          'payment-service',
          203,
          156.3,
          0.03,
          200,
          11111,
          '/api/payments',
          'POST',
          true,
          4096,
          'eu-west-1',
          'ghi789',
          '2023-01-01 12:02:01',
          67.5,
        ],
      ],
    },
    query_name_c: {
      columns: null,
      sampleRows: null,
      error: '[sse.dataQueryError] failed to execute query [query_name_c]: invalid query type. aframes_builder',
    },
  },
};

// Type definitions for schema
interface SchemaField {
  name: string;
  mysqlType: string;
  dataFrameFieldType: string;
  nullable: boolean;
}

type SampleValue = string | number | boolean;
type SampleRow = SampleValue[];
type SampleRows = SampleRow[];

interface SchemaData {
  columns: SchemaField[] | null;
  sampleRows: SampleRows | null;
  error?: string;
}

interface SchemaResponse {
  [refId: string]: SchemaData;
}

export const SchemaInspectorPanel = ({ className }: { className?: string }) => {
  const styles = useStyles2(getStyles);

  const availableRefIds = Object.keys(testData.SQLSchema);

  const [activeSchemaTab, setActiveSchemaTab] = useState(availableRefIds[0] || '');

  // TODO: Replace testData with actual schema data from props/context
  const schemaResponse: SchemaResponse = testData.SQLSchema;
  const refIds = Object.keys(schemaResponse);
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

  if (!activeSchemaData) {
    return null;
  }

  return (
    // Have to use div instead of Stack because Stack doesn't support className
    <div className={`${styles.schemaInspector} ${className || ''}`}>
      <TabsBar className={styles.tabsBar}>
        {refIds.map((refId) => (
          <Tab
            key={refId}
            label={refId}
            active={activeSchemaTab === refId}
            onChangeTab={() => setActiveSchemaTab(refId)}
          />
        ))}
      </TabsBar>
      <ScrollContainer backgroundColor="primary">
        <TabContent>{renderSchemaTabContent(activeSchemaData)}</TabContent>
      </ScrollContainer>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  schemaInspector: css({
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  }),
  tabsBar: css({
    flexShrink: 0, // Keep tabs pinned to top
  }),
  tableCell: css({
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    fontFamily: theme.typography.fontFamilyMonospace,
  }),
  tableContainer: css({
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
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
