import { BuilderQueryEditorExpressionType } from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn } from '../../types';

import { AzureMonitorKustoQueryParser } from './AzureMonitorKustoQueryParser';

describe('AzureMonitorKustoQueryParser', () => {
  const columns: AzureLogAnalyticsMetadataColumn[] = [
    { name: 'TimeGenerated', type: 'datetime' },
    { name: 'Level', type: 'string' },
    { name: 'Message', type: 'string' },
  ];

  it('returns empty string if from table is not specified', () => {
    const builderQuery: any = { from: { property: { name: '' } } };
    const result = AzureMonitorKustoQueryParser.toQuery(builderQuery, columns);
    expect(result).toBe('');
  });

  it('builds a simple query with table and project', () => {
    const builderQuery: any = {
      from: { property: { name: 'Logs' } },
      columns: { columns: ['TimeGenerated', 'Level', 'Message'] },
    };

    const result = AzureMonitorKustoQueryParser.toQuery(builderQuery, columns);
    expect(result).toContain('Logs');
    expect(result).toContain('project TimeGenerated, Level, Message');
  });

  it('includes time filter when needed', () => {
    const builderQuery: any = {
      from: { property: { name: 'Logs' } },
      columns: { columns: ['TimeGenerated', 'Level'] },
    };

    const result = AzureMonitorKustoQueryParser.toQuery(builderQuery, columns);
    expect(result).toContain('where $__timeFilter(TimeGenerated)');
  });

  it('applies additional filters', () => {
    const builderQuery: any = {
      from: { property: { name: 'Logs' } },
      columns: { columns: ['Level', 'Message'] },
    };

    const result = AzureMonitorKustoQueryParser.toQuery(
      builderQuery,
      columns,
      undefined,
      "Level == 'Error' and Message contains 'fail'"
    );

    expect(result).toContain("where $__timeFilter(TimeGenerated) and Level == 'Error' and Message contains 'fail'");
  });

  it('handles where expressions with operator', () => {
    const builderQuery: any = {
      from: { property: { name: 'Logs' } },
      columns: { columns: ['Level', 'Message'] },
      where: {
        expressions: [
          {
            type: BuilderQueryEditorExpressionType.Operator,
            operator: { name: '==', value: 'Error' },
            property: { name: 'Level' },
          },
        ],
      },
    };

    const result = AzureMonitorKustoQueryParser.toQuery(builderQuery, columns);
    expect(result).toContain("where $__timeFilter(TimeGenerated) and Level == 'Error'");
  });

  it('adds summarize with groupBy', () => {
    const builderQuery: any = {
      from: { property: { name: 'Logs' } },
      columns: { columns: ['Level'] },
      groupBy: {
        expressions: [{ property: { name: 'Level' } }],
      },
    };

    const result = AzureMonitorKustoQueryParser.toQuery(builderQuery, columns, 'count()');
    expect(result).toContain('summarize count() by Level');
  });

  it('adds order by clause', () => {
    const builderQuery: any = {
      from: { property: { name: 'Logs' } },
      columns: { columns: ['TimeGenerated', 'Level'] },
      orderBy: {
        expressions: [
          { property: { name: 'TimeGenerated' }, order: 'desc' },
        ],
      },
    };

    const result = AzureMonitorKustoQueryParser.toQuery(builderQuery, columns);
    expect(result).toContain('order by TimeGenerated desc');
  });

  it('adds limit clause', () => {
    const builderQuery: any = {
      from: { property: { name: 'Logs' } },
      columns: { columns: ['TimeGenerated', 'Level'] },
      limit: 50,
    };

    const result = AzureMonitorKustoQueryParser.toQuery(builderQuery, columns);
    expect(result).toContain('limit 50');
  });
});
