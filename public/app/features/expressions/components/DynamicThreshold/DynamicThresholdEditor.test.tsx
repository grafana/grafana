import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { ExpressionDatasourceRef } from '@grafana/runtime/internal';

import { EvalFunction } from '../../../alerting/state/alertDef';
import { type DynamicThresholdPolicyV1, ExpressionQueryType, type SqlExpressionQuery } from '../../types';

import { DynamicThresholdEditor } from './DynamicThresholdEditor';
import { buildDynamicThreshold } from './buildDynamicThreshold';

const mockSourcePreview = jest.fn();

jest.mock('./sourcePreview', () => ({
  getDynamicThresholdSourceOptions: (queries: Array<{ refId: string }>, selfRefId: string) =>
    queries.filter((query) => query.refId !== selfRefId).map((query) => ({ value: query.refId, label: query.refId })),
  useDynamicThresholdSourcePreview: (...args: unknown[]) => mockSourcePreview(...args),
}));

const mockSqlEditor = jest.fn();
jest.mock('../SqlExpressions/SqlEditor/SqlEditor', () => ({
  SqlEditor: (props: { value: string; readOnly?: boolean; ariaLabel?: string }) => {
    mockSqlEditor(props);
    return <pre aria-label={props.ariaLabel}>{props.value}</pre>;
  },
}));

const sourceQuery = {
  refId: 'A',
  queryType: '',
  datasourceUid: 'prometheus',
  model: { refId: 'A', datasource: { uid: 'prometheus', type: 'prometheus' } },
};

function makeQuery(overrides: Partial<DynamicThresholdPolicyV1> = {}): SqlExpressionQuery {
  return {
    refId: 'B',
    datasource: ExpressionDatasourceRef,
    type: ExpressionQueryType.sql,
    expression: 'stale SQL',
    format: 'alerting',
    dynamicThreshold: {
      version: 1,
      policy: {
        inputRefId: 'A',
        valueField: 'value',
        matchLabel: 'region',
        labelColumns: ['region', 'cluster'],
        evaluator: EvalFunction.IsAbove,
        mappings: [{ labelValue: 'us-east', thresholds: [5] }],
        defaultThreshold: [10],
        ...overrides,
      },
    },
  };
}

beforeEach(() => {
  mockSourcePreview.mockReturnValue({
    numericFields: ['value'],
    stringFields: ['region', 'cluster'],
    labelValues: ['us-east', 'eu-west'],
    loading: false,
    error: null,
    hasSchema: true,
  });
});

describe('DynamicThresholdEditor', () => {
  it.each([
    {
      state: 'loading',
      preview: { loading: true, error: null, hasSchema: false, numericFields: [], stringFields: [], labelValues: [] },
      text: 'Loading source schema',
    },
    {
      state: 'error',
      preview: {
        loading: false,
        error: new Error('schema failed'),
        hasSchema: false,
        numericFields: [],
        stringFields: [],
        labelValues: [],
      },
      text: 'schema failed',
    },
    {
      state: 'no data',
      preview: { loading: false, error: null, hasSchema: true, numericFields: [], stringFields: [], labelValues: [] },
      text: 'No fields found',
    },
  ])('renders the schema $state state', ({ preview, text }) => {
    mockSourcePreview.mockReturnValue(preview);
    render(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={jest.fn()} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('auto-selects the only numeric field and requires selection when there are multiple fields', async () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <DynamicThresholdEditor query={makeQuery({ valueField: '' })} queries={[sourceQuery]} onChange={onChange} />
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dynamicThreshold: expect.objectContaining({
          policy: expect.objectContaining({ valueField: 'value' }),
        }),
      })
    );

    onChange.mockClear();
    mockSourcePreview.mockReturnValue({
      numericFields: ['value', 'peak'],
      stringFields: ['region'],
      labelValues: [],
      loading: false,
      error: null,
      hasSchema: true,
    });
    rerender(
      <DynamicThresholdEditor
        query={makeQuery({ valueField: '', labelColumns: ['region'] })}
        queries={[sourceQuery]}
        onChange={onChange}
      />
    );

    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('combobox', { name: 'Numeric field' }));
    expect(screen.getByText('value')).toBeInTheDocument();
    expect(screen.getByText('peak')).toBeInTheDocument();
  });

  it('atomically updates policy, generated SQL, alerting format, and label columns for a valid edit', () => {
    const onChange = jest.fn();
    render(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Default threshold' }), {
      target: { value: '12' },
    });

    const update = onChange.mock.calls.at(-1)?.[0];
    expect(update).toEqual(
      expect.objectContaining({
        expression: expect.stringContaining('WHEN `A`.`value` >'),
        format: 'alerting',
        dynamicThreshold: expect.objectContaining({
          policy: expect.objectContaining({ defaultThreshold: [12], labelColumns: ['region', 'cluster'] }),
        }),
      })
    );
  });

  it('clears stale SQL and places a structured field error when policy becomes invalid', () => {
    const onChange = jest.fn();
    render(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Default threshold' }), { target: { value: '' } });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ expression: '' }));
    expect(onChange.mock.calls.at(-1)?.[0].dynamicThreshold.policy.defaultThreshold).toEqual([undefined]);
  });

  it('selecting the current input query is a no-op', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Input query' }));
    await user.click(screen.getAllByText('A').at(-1)!);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clears schema-dependent policy state when the input query changes', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const otherSourceQuery = {
      refId: 'C',
      queryType: '',
      datasourceUid: 'loki',
      model: { refId: 'C', datasource: { uid: 'loki', type: 'loki' } },
    };
    render(
      <DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery, otherSourceQuery]} onChange={onChange} />
    );

    await user.click(screen.getByRole('combobox', { name: 'Input query' }));
    await user.click(screen.getByText('C'));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expression: '',
        dynamicThreshold: expect.objectContaining({
          policy: expect.objectContaining({
            inputRefId: 'C',
            valueField: '',
            matchLabel: '',
            labelColumns: [],
            mappings: [],
            defaultThreshold: [],
          }),
        }),
      })
    );
  });

  it('does not rewrite a populated saved policy when schema loads or returns no data', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />
    );

    expect(onChange).not.toHaveBeenCalled();
    mockSourcePreview.mockReturnValue({
      numericFields: [],
      stringFields: [],
      labelValues: [],
      loading: false,
      error: null,
      hasSchema: true,
    });
    rerender(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <DynamicThresholdEditor
        query={makeQuery({ valueField: '', labelColumns: [] })}
        queries={[sourceQuery]}
        onChange={onChange}
      />
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('preserves positional range slots when the upper bound is entered first and the lower bound is cleared', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    function StatefulEditor() {
      const [query, setQuery] = useState(
        makeQuery({ evaluator: EvalFunction.IsWithinRange, defaultThreshold: [1, 2] })
      );
      return (
        <DynamicThresholdEditor
          query={query}
          queries={[sourceQuery]}
          onChange={(nextQuery) => {
            onChange(nextQuery);
            setQuery(nextQuery);
          }}
        />
      );
    }

    render(<StatefulEditor />);
    await user.clear(screen.getByRole('spinbutton', { name: 'Default lower threshold' }));
    expect(onChange.mock.calls.at(-1)?.[0].dynamicThreshold.policy.defaultThreshold).toEqual([undefined, 2]);

    await user.clear(screen.getByRole('spinbutton', { name: 'Default upper threshold' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Default upper threshold' }), '9');
    expect(onChange.mock.calls.at(-1)?.[0].dynamicThreshold.policy.defaultThreshold).toEqual([undefined, 9]);
  });

  it('resizes threshold slots only when operator arity changes', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const { rerender } = render(
      <DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />
    );

    await user.click(screen.getByRole('button', { name: 'Operator' }));
    await user.click(screen.getByText('Is within range'));
    expect(onChange.mock.calls.at(-1)?.[0].dynamicThreshold.policy.defaultThreshold).toEqual([10, undefined]);
    expect(onChange.mock.calls.at(-1)?.[0].dynamicThreshold.policy.mappings[0].thresholds).toEqual([5, undefined]);

    rerender(
      <DynamicThresholdEditor
        query={makeQuery({
          evaluator: EvalFunction.IsWithinRange,
          defaultThreshold: [10, 20],
          mappings: [{ labelValue: 'us-east', thresholds: [5, 15] }],
        })}
        queries={[sourceQuery]}
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Operator' }));
    await user.click(screen.getByText('Is above'));
    expect(onChange.mock.calls.at(-1)?.[0].dynamicThreshold.policy.defaultThreshold).toEqual([10]);
    expect(onChange.mock.calls.at(-1)?.[0].dynamicThreshold.policy.mappings[0].thresholds).toEqual([5]);
  });

  it('keeps mappings unchanged when preview suggestions refresh', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />
    );
    mockSourcePreview.mockReturnValue({
      numericFields: ['value'],
      stringFields: ['region', 'cluster'],
      labelValues: ['new-suggestion'],
      loading: false,
      error: null,
      hasSchema: true,
    });
    rerender(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('regenerates label columns from the live schema after a user-driven policy edit', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    function StatefulEditor() {
      const [query, setQuery] = useState(makeQuery({ labelColumns: ['region'] }));
      return (
        <DynamicThresholdEditor
          query={query}
          queries={[sourceQuery]}
          onChange={(nextQuery) => {
            onChange(nextQuery);
            setQuery(nextQuery);
          }}
        />
      );
    }

    render(<StatefulEditor />);
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('combobox', { name: 'Match label' }));
    await user.click(screen.getByText('cluster'));
    await user.click(screen.getByRole('button', { name: 'Change label' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Default threshold' }), '12');

    const update = onChange.mock.calls.at(-1)?.[0];
    expect(update.dynamicThreshold.policy).toEqual(
      expect.objectContaining({ matchLabel: 'cluster', labelColumns: ['region', 'cluster'], defaultThreshold: [12] })
    );
    expect(update.expression).toContain('`A`.`region` AS `region`');
    expect(update.expression).toContain('`A`.`cluster` AS `cluster`');
  });

  it.each([
    {
      name: 'label-column collisions',
      query: makeQuery({ labelColumns: ['region', 'alert_result'] }),
      message: 'Label column alert_result conflicts with a generated output column.',
    },
    {
      name: 'generated SQL length',
      query: makeQuery({
        mappings: Array.from({ length: 20 }, (_, index) => ({
          labelValue: `region-${index}-${'x'.repeat(600)}`,
          thresholds: [index],
        })),
      }),
      message: 'Generated SQL must not exceed 10000 characters.',
    },
  ])('renders $name errors in a general alert', ({ query, message }) => {
    render(<DynamicThresholdEditor query={query} queries={[sourceQuery]} onChange={jest.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to generate SQL');
    expect(screen.getByRole('alert')).toHaveTextContent(message);
  });

  it('selecting the current match label is a no-op', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Match label' }));
    await user.click(screen.getAllByText('region').at(-1)!);

    expect(screen.queryByText('Change match label?')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('requires confirmation before changing labels and cancel preserves policy', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Match label' }));
    await user.click(screen.getByText('cluster'));
    expect(screen.getByText('Change match label?')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('combobox', { name: 'Match label' }));
    await user.click(screen.getByText('cluster'));
    await user.click(screen.getByRole('button', { name: 'Change label' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expression: '',
        dynamicThreshold: expect.objectContaining({
          policy: expect.objectContaining({ matchLabel: 'cluster', mappings: [], defaultThreshold: [] }),
        }),
      })
    );
  });

  describe('layout', () => {
    it('labels the shared operator select and keeps the existing accessible names', () => {
      render(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={jest.fn()} />);

      expect(screen.getByRole('button', { name: 'Operator' })).toHaveTextContent('Is above');
      expect(screen.getByRole('combobox', { name: 'Input query' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Match label' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'Mapping row 1 label value' })).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: 'Mapping row 1 threshold' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove mapping row 1' })).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: 'Default threshold' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Move mapping row/ })).not.toBeInTheDocument();
    });

    it('shows range inputs separated by TO for the default and every mapping row', async () => {
      const onChange = jest.fn();
      render(
        <DynamicThresholdEditor
          query={makeQuery({
            evaluator: EvalFunction.IsWithinRange,
            mappings: [{ labelValue: 'us-east', thresholds: [1, 2] }],
            defaultThreshold: [3, 4],
          })}
          queries={[sourceQuery]}
          onChange={onChange}
        />
      );

      expect(screen.getByRole('spinbutton', { name: 'Mapping row 1 lower threshold' })).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: 'Mapping row 1 upper threshold' })).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: 'Default lower threshold' })).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: 'Default upper threshold' })).toBeInTheDocument();
      expect(screen.getAllByText('TO')).toHaveLength(2);
    });

    it('renders the default after the Add mapping button', () => {
      render(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={jest.fn()} />);

      const add = screen.getByRole('button', { name: 'Add mapping' });
      const defaultInput = screen.getByRole('spinbutton', { name: 'Default threshold' });
      expect(add.compareDocumentPosition(defaultInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.getByText('Default *')).toBeInTheDocument();
    });

    it('hides the numeric field when the only numeric field is __value__ but still selects it', () => {
      const onChange = jest.fn();
      mockSourcePreview.mockReturnValue({
        numericFields: ['__value__'],
        stringFields: ['region', 'cluster'],
        labelValues: [],
        loading: false,
        error: null,
        hasSchema: true,
      });
      render(
        <DynamicThresholdEditor query={makeQuery({ valueField: '' })} queries={[sourceQuery]} onChange={onChange} />
      );

      expect(screen.queryByRole('combobox', { name: 'Numeric field' })).not.toBeInTheDocument();
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          dynamicThreshold: expect.objectContaining({
            policy: expect.objectContaining({ valueField: '__value__' }),
          }),
        })
      );
    });

    it.each([
      { name: 'one field with another name', numericFields: ['value'] },
      { name: 'several fields', numericFields: ['__value__', 'peak'] },
    ])('shows the numeric field for $name', ({ numericFields }) => {
      mockSourcePreview.mockReturnValue({
        numericFields,
        stringFields: ['region', 'cluster'],
        labelValues: [],
        loading: false,
        error: null,
        hasSchema: true,
      });
      render(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={jest.fn()} />);

      expect(screen.getByRole('combobox', { name: 'Numeric field' })).toBeInTheDocument();
    });

    it('keeps the numeric field visible when the saved value field is not __value__', () => {
      mockSourcePreview.mockReturnValue({
        numericFields: ['__value__'],
        stringFields: ['region', 'cluster'],
        labelValues: [],
        loading: false,
        error: null,
        hasSchema: true,
      });
      render(
        <DynamicThresholdEditor
          query={makeQuery({ valueField: 'stale' })}
          queries={[sourceQuery]}
          onChange={jest.fn()}
        />
      );

      expect(screen.getByRole('combobox', { name: 'Numeric field' })).toBeInTheDocument();
    });

    it('does not show the numeric field while the schema loads unless the saved value field is custom', () => {
      mockSourcePreview.mockReturnValue({
        numericFields: [],
        stringFields: [],
        labelValues: [],
        loading: true,
        error: null,
        hasSchema: false,
      });
      const { unmount } = render(
        <DynamicThresholdEditor query={makeQuery({ valueField: '' })} queries={[sourceQuery]} onChange={jest.fn()} />
      );
      expect(screen.queryByRole('combobox', { name: 'Numeric field' })).not.toBeInTheDocument();
      expect(screen.queryByText('Unable to generate SQL')).not.toBeInTheDocument();
      unmount();

      render(
        <DynamicThresholdEditor
          query={makeQuery({ valueField: 'latency' })}
          queries={[sourceQuery]}
          onChange={jest.fn()}
        />
      );
      expect(screen.getByRole('combobox', { name: 'Numeric field' })).toBeInTheDocument();
    });

    it('gives every control a unique id and points the Operator and Default labels at a control', () => {
      render(
        <DynamicThresholdEditor
          query={makeQuery({
            evaluator: EvalFunction.IsWithinRange,
            mappings: [
              { labelValue: 'us-east', thresholds: [1, 2] },
              { labelValue: 'eu-west', thresholds: [3, 4] },
            ],
            defaultThreshold: [5, 6],
          })}
          queries={[sourceQuery]}
          onChange={jest.fn()}
        />
      );

      const ids = Array.from(document.querySelectorAll('input[id], button[id]')).map((element) => element.id);
      expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
      expect(screen.getByText('Operator').closest('label')).toHaveAttribute(
        'for',
        screen.getByRole('button', { name: 'Operator' }).id
      );
      expect(screen.getByText('Default *').closest('label')).toHaveAttribute(
        'for',
        screen.getByRole('spinbutton', { name: 'Default lower threshold' }).id
      );
    });

    it('compiles identical SQL whether or not the numeric field is shown', () => {
      const compiledFor = (numericFields: string[]) => {
        mockSourcePreview.mockReturnValue({
          numericFields,
          stringFields: ['region', 'cluster'],
          labelValues: [],
          loading: false,
          error: null,
          hasSchema: true,
        });
        const onChange = jest.fn();
        const { unmount } = render(
          <DynamicThresholdEditor
            query={makeQuery({ valueField: '__value__' })}
            queries={[sourceQuery]}
            onChange={onChange}
          />
        );
        fireEvent.change(screen.getByRole('spinbutton', { name: 'Default threshold' }), { target: { value: '12' } });
        const hidden = screen.queryByRole('combobox', { name: 'Numeric field' }) === null;
        unmount();
        return { hidden, expression: onChange.mock.calls.at(-1)?.[0].expression };
      };

      const hiddenField = compiledFor(['__value__']);
      const shownField = compiledFor(['__value__', 'peak']);
      expect(hiddenField.hidden).toBe(true);
      expect(shownField.hidden).toBe(false);
      expect(hiddenField.expression).toContain('`A`.`__value__`');
      expect(hiddenField.expression).toBe(shownField.expression);
    });
  });

  describe('input preselection', () => {
    it('selects the first data source query when no input is set', () => {
      const onChange = jest.fn();
      render(
        <DynamicThresholdEditor
          query={makeQuery({ inputRefId: '', valueField: '', matchLabel: '', labelColumns: [], mappings: [] })}
          queries={[sourceQuery]}
          onChange={onChange}
        />
      );

      expect(onChange.mock.calls[0][0].dynamicThreshold.policy.inputRefId).toBe('A');
    });

    it('does not override an existing input', () => {
      const onChange = jest.fn();
      render(<DynamicThresholdEditor query={makeQuery()} queries={[sourceQuery]} onChange={onChange} />);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('live validation', () => {
    it('shows required errors for a fresh editor under the match label and default fields', () => {
      render(
        <DynamicThresholdEditor
          query={makeQuery({ matchLabel: '', labelColumns: [], mappings: [], defaultThreshold: [] })}
          queries={[sourceQuery]}
          onChange={jest.fn()}
        />
      );

      expect(screen.getByText('Select a match label.')).toBeInTheDocument();
      expect(screen.getByText('The default threshold requires 1 value(s).')).toBeInTheDocument();
    });

    it('shows no error for a newly added empty mapping row until it is touched', async () => {
      const user = userEvent.setup();

      function StatefulEditor() {
        const [query, setQuery] = useState(makeQuery({ mappings: [] }));
        return <DynamicThresholdEditor query={query} queries={[sourceQuery]} onChange={setQuery} />;
      }

      render(<StatefulEditor />);
      await user.click(screen.getByRole('button', { name: 'Add mapping' }));

      expect(screen.getByRole('combobox', { name: 'Mapping row 1 label value' })).toBeInTheDocument();
      expect(screen.queryByText(/Mapping row 1 requires/)).not.toBeInTheDocument();

      await user.type(screen.getByRole('spinbutton', { name: 'Mapping row 1 threshold' }), '4');
      expect(screen.getByText('Mapping row 1 requires a label value.')).toBeInTheDocument();
    });

    it('shows the error of a saved empty mapping row on mount', () => {
      render(
        <DynamicThresholdEditor
          query={makeQuery({ mappings: [{ labelValue: '', thresholds: [] }] })}
          queries={[sourceQuery]}
          onChange={jest.fn()}
        />
      );

      expect(screen.getByText(/Mapping row 1 requires a label value/)).toBeInTheDocument();
    });

    it('forgets touched rows when the mappings are cleared by a match label change', async () => {
      const user = userEvent.setup();

      function StatefulEditor() {
        const [query, setQuery] = useState(makeQuery({ mappings: [{ labelValue: 'us-east', thresholds: [5] }] }));
        return <DynamicThresholdEditor query={query} queries={[sourceQuery]} onChange={setQuery} />;
      }

      render(<StatefulEditor />);
      await user.click(screen.getByRole('combobox', { name: 'Match label' }));
      await user.click(screen.getByText('cluster'));
      await user.click(screen.getByRole('button', { name: 'Change label' }));
      expect(screen.queryByRole('combobox', { name: 'Mapping row 1 label value' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Add mapping' }));
      expect(screen.getByRole('combobox', { name: 'Mapping row 1 label value' })).toBeInTheDocument();
      expect(screen.queryByText(/Mapping row 1 requires/)).not.toBeInTheDocument();
    });

    it('shows a duplicate label value error under the offending row', () => {
      render(
        <DynamicThresholdEditor
          query={makeQuery({
            mappings: [
              { labelValue: 'us-east', thresholds: [1] },
              { labelValue: 'us-east', thresholds: [2] },
            ],
          })}
          queries={[sourceQuery]}
          onChange={jest.fn()}
        />
      );

      expect(screen.getByText('Mapping row 2 duplicates another label value.')).toBeInTheDocument();
    });
  });

  describe('SQL view and conversion', () => {
    function makeGeneratedQuery(): SqlExpressionQuery {
      const query = makeQuery();
      const built = buildDynamicThreshold(query.dynamicThreshold!.policy);
      if (!built.ok) {
        throw new Error('test policy must compile');
      }
      return { ...query, expression: built.expressionSql };
    }

    it('shows the generated SQL read-only and hides it again', async () => {
      const query = makeGeneratedQuery();
      const onChange = jest.fn();
      render(<DynamicThresholdEditor query={query} queries={[sourceQuery]} onChange={onChange} />);

      expect(screen.queryByLabelText('Generated SQL')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'View SQL' }));

      expect(screen.getByLabelText('Generated SQL')).toHaveTextContent('SELECT');
      expect(mockSqlEditor).toHaveBeenLastCalledWith(
        expect.objectContaining({ value: query.expression, readOnly: true })
      );
      expect(onChange).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: 'Hide SQL' }));
      expect(screen.queryByLabelText('Generated SQL')).not.toBeInTheDocument();
    });

    it('disables View SQL and Edit as SQL while there is no generated SQL', () => {
      render(
        <DynamicThresholdEditor
          query={{ ...makeQuery({ defaultThreshold: [] }), expression: '' }}
          queries={[sourceQuery]}
          onChange={jest.fn()}
        />
      );

      expect(screen.getByRole('button', { name: 'View SQL' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Edit as SQL' })).toBeDisabled();
    });

    it('converts to regular SQL after confirmation, keeping the SQL and removing the policy', async () => {
      const query = makeGeneratedQuery();
      const onChange = jest.fn();
      render(<DynamicThresholdEditor query={query} queries={[sourceQuery]} onChange={onChange} />);

      await userEvent.click(screen.getByRole('button', { name: 'Edit as SQL' }));
      expect(screen.getByText(/cannot be reversed automatically/)).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();

      const dialog = screen.getByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Edit as SQL' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const converted = onChange.mock.calls[0][0];
      expect(converted.expression).toBe(query.expression);
      expect(converted.format).toBe('alerting');
      expect(converted).not.toHaveProperty('dynamicThreshold');
    });

    it('leaves the query unchanged when the conversion is cancelled', async () => {
      const onChange = jest.fn();
      render(<DynamicThresholdEditor query={makeGeneratedQuery()} queries={[sourceQuery]} onChange={onChange} />);

      await userEvent.click(screen.getByRole('button', { name: 'Edit as SQL' }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
