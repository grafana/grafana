import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { select } from 'react-select-event';

import { TimeRange, dateTime } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

import { createLokiDatasource } from '../mocks/datasource';
import { LokiVariableQueryType } from '../types';

import { LokiVariableQueryEditor, Props } from './VariableQueryEditor';

const refId = 'LokiVariableQueryEditor-VariableQuery';

describe('LokiVariableQueryEditor', () => {
  let props: Props;

  beforeEach(() => {
    props = {
      datasource: createLokiDatasource({} as unknown as TemplateSrv),
      query: {
        refId: 'test',
        type: LokiVariableQueryType.LabelNames,
      },
      onRunQuery: () => {},
      onChange: () => {},
    };

    jest.spyOn(props.datasource.languageProvider, 'fetchLabels').mockResolvedValue(['luna', 'moon']);
  });

  test('Allows to create a Label names variable', async () => {
    const onChange = jest.fn();
    render(<LokiVariableQueryEditor {...props} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();
    await select(screen.getByLabelText('Query type'), 'Label names', { container: document.body });

    expect(onChange).toHaveBeenCalledWith({
      type: LokiVariableQueryType.LabelNames,
      label: '',
      stream: '',
      refId,
    });
  });

  test('Allows to create a Label values variable', async () => {
    const onChange = jest.fn();
    render(<LokiVariableQueryEditor {...props} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();

    await waitFor(() => select(screen.getByLabelText('Query type'), 'Label values', { container: document.body }));
    await select(screen.getByLabelText('Label'), 'luna', { container: document.body });
    await userEvent.type(screen.getByLabelText('Stream selector'), 'stream');

    await waitFor(() => expect(screen.getByDisplayValue('stream')).toBeInTheDocument());

    await userEvent.click(document.body);

    expect(onChange).toHaveBeenCalledWith({
      type: LokiVariableQueryType.LabelValues,
      label: 'luna',
      stream: 'stream',
      refId,
    });
  });

  test('Allows to create a Label values variable with custom label', async () => {
    const onChange = jest.fn();
    render(<LokiVariableQueryEditor {...props} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => select(screen.getByLabelText('Query type'), 'Label values', { container: document.body }));

    await userEvent.type(screen.getByLabelText('Label'), 'sol{enter}');
    await userEvent.type(screen.getByLabelText('Stream selector'), 'stream');

    await waitFor(() => expect(screen.getByDisplayValue('stream')).toBeInTheDocument());

    await userEvent.click(document.body);

    expect(onChange).toHaveBeenCalledWith({
      type: LokiVariableQueryType.LabelValues,
      label: 'sol',
      stream: 'stream',
      refId,
    });
  });

  test('Migrates legacy string queries to LokiVariableQuery instances', async () => {
    const query = 'label_values(log stream selector, luna)';
    // @ts-expect-error
    render(<LokiVariableQueryEditor {...props} onChange={() => {}} query={query} />);

    await waitFor(() => expect(screen.getByText('Label values')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('luna')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByDisplayValue('log stream selector')).toBeInTheDocument());
  });

  test('Receives a query instance and assigns its values when editing', async () => {
    render(
      <LokiVariableQueryEditor
        {...props}
        onChange={() => {}}
        query={{
          type: LokiVariableQueryType.LabelValues,
          label: 'luna',
          stream: 'log stream selector',
          refId,
        }}
      />
    );

    await waitFor(() => expect(screen.getByText('Label values')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('luna')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByDisplayValue('log stream selector')).toBeInTheDocument());
  });

  test('Label options are not lost when selecting one', async () => {
    const { rerender } = render(<LokiVariableQueryEditor {...props} onChange={() => {}} />);
    await waitFor(() => select(screen.getByLabelText('Query type'), 'Label values', { container: document.body }));
    await select(screen.getByLabelText('Label'), 'luna', { container: document.body });

    const updatedQuery = {
      refId: 'test',
      type: LokiVariableQueryType.LabelValues,
      label: 'luna',
    };
    rerender(<LokiVariableQueryEditor {...props} query={updatedQuery} onChange={() => {}} />);

    await select(screen.getByLabelText('Label'), 'moon', { container: document.body });
    await select(screen.getByLabelText('Label'), 'luna', { container: document.body });
    await screen.findByText('luna');
  });

  test('Calls language provider fetchLabels with the time range received in props', async () => {
    const now = dateTime('2023-09-16T21:26:00Z');
    const range: TimeRange = {
      from: dateTime(now).subtract(2, 'days'),
      to: now,
      raw: {
        from: 'now-2d',
        to: 'now',
      },
    };
    props.range = range;
    props.query = {
      refId: 'test',
      type: LokiVariableQueryType.LabelValues,
      label: 'luna',
    };

    render(<LokiVariableQueryEditor {...props} />);
    await waitFor(() =>
      expect(props.datasource.languageProvider.fetchLabels).toHaveBeenCalledWith({ timeRange: range })
    );
  });

  test('does not re-run fetch labels when type does not change', async () => {
    const now = dateTime('2023-09-16T21:26:00Z');
    const range: TimeRange = {
      from: dateTime(now).subtract(2, 'days'),
      to: now,
      raw: {
        from: 'now-2d',
        to: 'now',
      },
    };
    props.range = range;
    props.query = {
      refId: 'test',
      type: LokiVariableQueryType.LabelValues,
    };

    props.datasource.languageProvider.fetchLabels = jest.fn().mockResolvedValue([]);
    const { rerender } = render(<LokiVariableQueryEditor {...props} />);
    rerender(
      <LokiVariableQueryEditor {...props} query={{ ...props.query, type: LokiVariableQueryType.LabelValues }} />
    );

    await waitFor(() => {
      expect(props.datasource.languageProvider.fetchLabels).toHaveBeenCalledTimes(1);
    });
  });

  test('runs fetch labels when type changes to from LabelNames to LabelValues', async () => {
    const now = dateTime('2023-09-16T21:26:00Z');
    const range: TimeRange = {
      from: dateTime(now).subtract(2, 'days'),
      to: now,
      raw: {
        from: 'now-2d',
        to: 'now',
      },
    };
    props.range = range;
    props.query = {
      refId: 'test',
      type: LokiVariableQueryType.LabelNames,
    };

    props.datasource.languageProvider.fetchLabels = jest.fn().mockResolvedValue([]);
    const { rerender } = render(<LokiVariableQueryEditor {...props} />);
    rerender(
      <LokiVariableQueryEditor {...props} query={{ ...props.query, type: LokiVariableQueryType.LabelValues }} />
    );

    await waitFor(() => {
      expect(props.datasource.languageProvider.fetchLabels).toHaveBeenCalledTimes(1);
    });
  });

  test('runs fetch labels when type changes to LabelValues', async () => {
    const now = dateTime('2023-09-16T21:26:00Z');
    const range: TimeRange = {
      from: dateTime(now).subtract(2, 'days'),
      to: now,
      raw: {
        from: 'now-2d',
        to: 'now',
      },
    };
    props.range = range;
    props.query = {
      refId: 'test',
      type: LokiVariableQueryType.LabelNames,
    };

    props.datasource.languageProvider.fetchLabels = jest.fn().mockResolvedValue([]);
    // Starting with LabelNames
    const { rerender } = render(<LokiVariableQueryEditor {...props} />);

    // Changing to LabelValues, should run fetchLabels
    rerender(
      <LokiVariableQueryEditor {...props} query={{ ...props.query, type: LokiVariableQueryType.LabelValues }} />
    );
    await waitFor(() => {
      expect(props.datasource.languageProvider.fetchLabels).toHaveBeenCalledTimes(1);
    });

    // Keeping the type of LabelValues, should not run additional fetchLabels
    rerender(
      <LokiVariableQueryEditor {...props} query={{ ...props.query, type: LokiVariableQueryType.LabelValues }} />
    );
    await waitFor(() => {
      expect(props.datasource.languageProvider.fetchLabels).toHaveBeenCalledTimes(1);
    });

    // Changing to LabelNames, should not run additional fetchLabels
    rerender(<LokiVariableQueryEditor {...props} query={{ ...props.query, type: LokiVariableQueryType.LabelNames }} />);
    await waitFor(() => {
      expect(props.datasource.languageProvider.fetchLabels).toHaveBeenCalledTimes(1);
    });

    // Changing to LabelValues, should run additional fetchLabels
    rerender(
      <LokiVariableQueryEditor {...props} query={{ ...props.query, type: LokiVariableQueryType.LabelValues }} />
    );
    await waitFor(() => {
      expect(props.datasource.languageProvider.fetchLabels).toHaveBeenCalledTimes(2);
    });
  });
});
