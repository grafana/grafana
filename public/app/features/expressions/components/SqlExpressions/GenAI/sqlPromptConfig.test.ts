import { getSQLSuggestionSystemPrompt, QueryUsageContext } from './sqlPromptConfig';

describe('getSQLSuggestionSystemPrompt', () => {
  it('includes all context fields in generated prompt', () => {
    const queryContext: QueryUsageContext = {
      panelId: 'timeseries',
      alerting: false,
      dashboardContext: {
        dashboardTitle: 'Production Metrics',
        panelName: 'CPU Usage',
      },
      datasources: ['prometheus', 'postgres'],
      totalRows: 5000,
      requestTime: 250,
      numberOfQueries: 3,
    };

    const result = getSQLSuggestionSystemPrompt({
      refIds: 'A, B',
      currentQuery: 'SELECT * FROM A',
      queryInstruction: 'Focus on fixing the current query',
      formattedSchemas: 'RefID A:\n  - time (TIMESTAMP, not null)\n  - value (FLOAT, nullable)',
      errorContext: ['Syntax error near WHERE'],
      queryContext,
    });

    expect(result).toContain('A, B');
    expect(result).toContain('SELECT * FROM A');
    expect(result).toContain('Focus on fixing the current query');
    expect(result).toContain('time (TIMESTAMP, not null)');
    expect(result).toContain('Syntax error near WHERE');
    expect(result).toContain('Panel Type: timeseries');
    expect(result).toContain('Dashboard: Production Metrics, Panel: CPU Usage');
    expect(result).toContain('Datasources: prometheus, postgres');
    expect(result).toContain('Total rows in the query: 5000');
    expect(result).toContain('Request time: 250');
    expect(result).toContain('Number of queries: 3');
  });

  it('formats multiple errors with newlines', () => {
    const result = getSQLSuggestionSystemPrompt({
      refIds: 'A',
      currentQuery: 'SELECT * FROM A',
      queryInstruction: 'Fix errors',
      errorContext: ['Error 1: Syntax error', 'Error 2: Column not found'],
    });

    expect(result).toContain('Error 1: Syntax error');
    expect(result).toContain('Error 2: Column not found');
    expect(result).toContain('Error 1: Syntax error\nError 2: Column not found');
  });
});
