import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ComponentProps } from 'react';

import { type InterpolateFunction, standardEditorsRegistry } from '@grafana/data';
import { mockComboboxRect } from '@grafana/test-utils';

import { getAllOptionEditors } from './registry';
import { getVarMappingToggleKind, VarMappingToggleEditor } from './varMappingToggle';
import { type VarMappingVariable, type VarMappingVariableSource } from './varMappingVariables';

jest.mock('app/core/components/SuggestionsInput/getVariableSuggestions', () => ({
  getVariableSuggestions: () => [
    { value: 't', label: 't', origin: 'template' },
    { value: 'other', label: 'other', origin: 'template' },
  ],
}));

// Records the open state the picker gets on each render; the list is only sized when it opens after mount
const pickerIsOpenRenders: Array<boolean | undefined> = [];
jest.mock('@grafana/ui', () => {
  const actual = jest.requireActual('@grafana/ui');
  const { createElement } = jest.requireActual('react');
  return {
    ...actual,
    Combobox: (props: { isOpen?: boolean }) => {
      pickerIsOpenRenders.push(props.isOpen);
      return createElement(actual.Combobox, props);
    },
  };
});

standardEditorsRegistry.setInit(getAllOptionEditors);

const getEditor = (id: string) => standardEditorsRegistry.get(id).editor;

const drawStyleItem = {
  id: 'custom.drawStyle',
  name: 'Style',
  settings: {
    options: [
      { value: 'line', label: 'Lines' },
      { value: 'bars', label: 'Bars' },
      { value: 'points', label: 'Points' },
    ],
  },
};

type Props = ComponentProps<typeof VarMappingToggleEditor>;

const getPicker = (name = 'Style') => screen.getByRole('combobox', { name: `Variable for ${name}` });

function radioProps(onChange: jest.Mock, props: Partial<Props> = {}): Props {
  return {
    editor: getEditor('radio'),
    kind: 'option',
    value: 'line',
    onChange,
    item: drawStyleItem,
    context: { data: [] },
    id: 'draw-style',
    ...props,
  };
}

function renderRadio(props: Partial<Props> = {}) {
  const onChange = jest.fn();
  const result = render(<VarMappingToggleEditor {...radioProps(onChange, props)} />);
  return { ...result, onChange };
}

describe('VarMappingToggleEditor', () => {
  beforeEach(() => {
    mockComboboxRect();
  });

  it('shows the plain control with an unpressed "Use variable" toggle while there is no expression', () => {
    renderRadio();

    expect(screen.getByRole('radio', { name: 'Lines' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Use variable' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('combobox', { name: 'Variable for Style' })).not.toBeInTheDocument();
  });

  it('passes plain picks through unchanged', async () => {
    const { onChange } = renderRadio();

    await userEvent.click(screen.getByRole('radio', { name: 'Bars' }));

    expect(onChange).toHaveBeenCalledWith('bars');
  });

  it('opens an empty variable picker when toggled on and goes back when toggled off without writing anything', async () => {
    const { onChange } = renderRadio();

    await userEvent.click(screen.getByRole('button', { name: 'Use variable' }));

    expect(screen.getByRole('button', { name: 'Use variable' })).toHaveAttribute('aria-pressed', 'true');
    expect(getPicker()).toHaveValue('');
    expect(await screen.findByRole('option', { name: 't' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'other' })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Use variable' }));

    expect(screen.getByRole('radio', { name: 'Lines' })).toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the focus on the toggle when switching modes', async () => {
    renderRadio();

    const toggle = screen.getByRole('button', { name: 'Use variable' });
    // The picker takes the focus when it opens; clicking the toggle again focuses it and turns it off
    await userEvent.click(toggle);
    await userEvent.click(toggle);

    expect(screen.getByRole('radio', { name: 'Lines' })).toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it('mounts the picker closed and opens it on the next render, so the list gets measured', async () => {
    renderRadio();
    pickerIsOpenRenders.length = 0;

    await userEvent.click(screen.getByRole('button', { name: 'Use variable' }));

    expect(pickerIsOpenRenders[0]).toBe(false);
    expect(pickerIsOpenRenders).toContain(true);
    expect(getPicker()).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes the picker when toggled off so turning it on again mounts it closed and opens it', async () => {
    renderRadio();

    await userEvent.click(screen.getByRole('button', { name: 'Use variable' }));
    expect(getPicker()).toHaveAttribute('aria-expanded', 'true');
    // A bare click, without the blur a real one causes first, so the list is still open when the toggle runs
    fireEvent.click(screen.getByRole('button', { name: 'Use variable' }));

    pickerIsOpenRenders.length = 0;
    await userEvent.click(screen.getByRole('button', { name: 'Use variable' }));

    expect(pickerIsOpenRenders[0]).toBe(false);
    expect(pickerIsOpenRenders).toContain(true);
    expect(getPicker()).toHaveAttribute('aria-expanded', 'true');
  });

  it('stores a picked variable as ${name}', async () => {
    const { onChange } = renderRadio();

    await userEvent.click(screen.getByRole('button', { name: 'Use variable' }));
    await userEvent.click(await screen.findByRole('option', { name: 'other' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('${other}');
  });

  it('shows $name and ${name} as their variable', () => {
    const { rerender } = renderRadio({ expression: '$t' });
    expect(getPicker()).toHaveValue('t');

    rerender(<VarMappingToggleEditor {...radioProps(jest.fn(), { expression: '${other}' })} />);
    expect(getPicker()).toHaveValue('other');
  });

  it('keeps showing an expression that is not a single variable until another is picked', async () => {
    const { onChange } = renderRadio({ expression: '${t}-${other}' });

    expect(getPicker()).toHaveValue('${t}-${other}');

    await userEvent.click(getPicker());
    await userEvent.click(await screen.findByRole('option', { name: 't' }));

    expect(onChange).toHaveBeenCalledWith('${t}');
  });

  it('shows the allowed values and the fallback label', () => {
    renderRadio({ expression: '${t}', value: 'bars' });

    expect(screen.getByText('Allowed values: line, bars, points. Falls back to: Bars')).toBeInTheDocument();
  });

  it('clears the expression when toggled off by writing the stored value back', async () => {
    const { onChange, rerender } = renderRadio({ expression: '$t', value: 'bars' });

    expect(screen.getByRole('button', { name: 'Use variable' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Use variable' }));
    expect(onChange).toHaveBeenCalledWith('bars');

    rerender(<VarMappingToggleEditor {...radioProps(onChange, { value: 'bars' })} />);
    expect(screen.getByRole('radio', { name: 'Bars' })).toBeChecked();
  });

  it('goes back to the plain control when a picked expression is removed from outside', async () => {
    const { onChange, rerender } = renderRadio();

    await userEvent.click(screen.getByRole('button', { name: 'Use variable' }));
    await userEvent.click(await screen.findByRole('option', { name: 't' }));
    expect(onChange).toHaveBeenCalledWith('${t}');

    rerender(<VarMappingToggleEditor {...radioProps(onChange, { expression: '${t}' })} />);
    expect(getPicker()).toHaveValue('t');

    rerender(<VarMappingToggleEditor {...radioProps(onChange)} />);
    expect(screen.queryByRole('combobox', { name: 'Variable for Style' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Lines' })).toBeChecked();
  });

  it('labels a numeric fallback with its option and lists typed values as text', () => {
    renderRadio({
      expression: '$align',
      value: -1,
      item: {
        id: 'custom.barAlignment',
        name: 'Bar alignment',
        settings: {
          options: [
            { value: -1, label: 'Before' },
            { value: 0, label: 'Center' },
          ],
        },
      },
    });

    expect(screen.getByText('Allowed values: -1, 0. Falls back to: Before')).toBeInTheDocument();
  });

  describe('boolean', () => {
    function renderSwitch(props: Partial<Props> = {}) {
      const onChange = jest.fn();
      render(
        <VarMappingToggleEditor
          editor={getEditor('boolean')}
          kind="boolean"
          value={true}
          onChange={onChange}
          item={{ id: 'custom.axisBorderShow', name: 'Show border' }}
          context={{ data: [] }}
          id="border"
          {...props}
        />
      );
      return { onChange };
    }

    it('wraps the switch and stores a picked variable', async () => {
      const { onChange } = renderSwitch();

      expect(screen.getByRole('switch')).toBeChecked();

      await userEvent.click(screen.getByRole('button', { name: 'Use variable' }));
      await userEvent.click(await screen.findByRole('option', { name: 't' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('${t}');
    });

    it('shows true and false as the allowed values and On or Off as the fallback', () => {
      renderSwitch({ expression: '$b', value: false });

      expect(screen.getByText('Allowed values: true, false. Falls back to: Off')).toBeInTheDocument();
    });
  });

  describe('slider', () => {
    const lineWidthItem = { id: 'custom.lineWidth', name: 'Line width', settings: { min: 0, max: 10, step: 1 } };

    function renderSlider(props: Partial<Props> = {}) {
      const onChange = jest.fn();
      render(
        <VarMappingToggleEditor
          editor={getEditor('slider')}
          kind="number"
          value={2}
          onChange={onChange}
          item={lineWidthItem}
          context={{ data: [] }}
          id="line-width"
          {...props}
        />
      );
      return { onChange };
    }

    it('keeps the slider next to the variable toggle', async () => {
      renderSlider();

      // Registry editors are lazy
      expect(await screen.findByRole('slider')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Use variable' })).toBeInTheDocument();
    });

    it('stores a picked variable and shows only the fallback in the hint', async () => {
      const { onChange } = renderSlider();

      await userEvent.click(screen.getByRole('button', { name: 'Use variable' }));
      await userEvent.click(await screen.findByRole('option', { name: 't' }));

      expect(onChange).toHaveBeenCalledWith('${t}');
      expect(getPicker('Line width')).toBeInTheDocument();
      expect(screen.getByText('Falls back to: 2')).toBeInTheDocument();
    });

    it('renders no hint without a stored value', () => {
      const { container } = render(
        <VarMappingToggleEditor
          editor={getEditor('slider')}
          kind="number"
          value={undefined}
          onChange={jest.fn()}
          item={lineWidthItem}
          context={{ data: [] }}
          id="line-width"
          expression="$t"
        />
      );

      expect(getPicker('Line width')).toHaveValue('t');
      expect(container).not.toHaveTextContent('Falls back');
      expect(container.querySelectorAll('span:empty')).toHaveLength(0);
    });
  });
});

describe('VarMappingToggleEditor with a variable source', () => {
  beforeEach(() => {
    mockComboboxRect();
  });

  // Raw values, as the scene interpolator passes them to a format function; arrays are multi-value
  function makeSource(values: Record<string, unknown>, variables: VarMappingVariable[]) {
    let listener = () => {};
    const interpolate: InterpolateFunction = (text, _scopedVars, format) =>
      text.replace(/\$\{(\w+)\}|\$(\w+)/g, (match, braced, plain) => {
        const name = braced ?? plain;
        if (!(name in values)) {
          return match;
        }
        return typeof format === 'function' ? format(values[name]) : String(values[name]);
      });
    const source: VarMappingVariableSource = {
      getVariables: () => variables,
      interpolate,
      subscribe: jest.fn((onChange) => {
        listener = onChange;
        return () => {};
      }),
      createVariable: jest.fn(() => true),
    };
    return { source, notify: () => listener() };
  }

  const styleValues = [
    { value: 'line', label: 'line' },
    { value: 'bars', label: 'bars' },
    { value: 'points', label: 'points' },
  ];

  const variables: VarMappingVariable[] = [
    { name: 'query', current: 'x' },
    {
      name: 'mixed',
      current: 'line',
      values: [
        { value: 'line', label: 'line' },
        { value: 'foo', label: 'foo' },
      ],
    },
    { name: 'style', current: 'bars', values: styleValues },
  ];

  it('says what the expression resolves to now, without the allowed values', () => {
    const { source } = makeSource({ style: 'bars' }, variables);
    renderRadio({ expression: '${style}', variables: source });

    expect(screen.getByText('Resolves to: Bars')).toBeInTheDocument();
    expect(screen.queryByText(/Allowed values/)).not.toBeInTheDocument();
  });

  it('resolves built-in variables, which are not in the variable list', () => {
    const { source } = makeSource({ __dashboard: 'bars' }, variables);
    renderRadio({ expression: '${__dashboard}', variables: source });

    expect(screen.getByText('Resolves to: Bars')).toBeInTheDocument();
  });

  it('warns when the current value is not allowed', () => {
    const { source } = makeSource({ query: 'x' }, variables);
    renderRadio({ expression: '${query}', variables: source });

    expect(screen.getByText('Current value "x" isn\'t allowed, so the fallback is used')).toBeInTheDocument();
    expect(screen.getByText(/Allowed values: line, bars, points/)).toBeInTheDocument();
  });

  it.each([
    ['more than one value', ['line', 'bars']],
    ['no value', []],
  ])('warns when %s is selected', (_, current) => {
    const { source } = makeSource({ query: current }, variables);
    renderRadio({ expression: '${query}', variables: source });

    expect(
      screen.getByText("The variable doesn't have exactly one value selected, so the fallback is used")
    ).toBeInTheDocument();
  });

  it('says a data macro resolves for each field instead of warning it was not found', () => {
    const { source } = makeSource({}, variables);
    renderRadio({ expression: '${__field.labels.style}', variables: source });

    expect(screen.getByText('Resolves for each field when the panel renders')).toBeInTheDocument();
    expect(screen.queryByText(/Variable not found/)).not.toBeInTheDocument();
  });

  it('warns when the variable does not exist', () => {
    const { source } = makeSource({}, variables);
    renderRadio({ expression: '${gone}', variables: source });

    expect(screen.getByText('Variable not found, so the fallback is used')).toBeInTheDocument();
  });

  it('lists the known values of the variable that would fall back', () => {
    const { source } = makeSource({ mixed: 'line' }, variables);
    renderRadio({ expression: '${mixed}', variables: source });

    expect(screen.getByText('Resolves to: Lines')).toBeInTheDocument();
    expect(screen.getByText('These values use the fallback: foo')).toBeInTheDocument();
  });

  it('follows variable changes reported by the source', () => {
    const values: Record<string, unknown> = { style: 'bars' };
    const { source, notify } = makeSource(values, variables);
    renderRadio({ expression: '${style}', variables: source });

    values.style = 'points';
    act(() => notify());

    expect(screen.getByText('Resolves to: Points')).toBeInTheDocument();
  });

  it('lists matching variables first with their current value', async () => {
    const { source } = makeSource({}, variables);
    renderRadio({ variables: source });

    await userEvent.click(screen.getByRole('button', { name: 'Use variable' }));
    const options = await screen.findAllByRole('option');

    expect(options.map((option) => option.textContent)).toEqual([
      expect.stringContaining('New variable with these values'),
      expect.stringContaining('style'),
      expect.stringContaining('query'),
      expect.stringContaining('mixed'),
    ]);
    expect(options[1]).toHaveTextContent('Current: bars');
    expect(screen.getByText('Matching values')).toBeInTheDocument();
    expect(screen.getByText('Other variables')).toBeInTheDocument();
  });

  it('creates a custom variable with the option values and maps it', async () => {
    const { source } = makeSource({}, variables);
    const { onChange } = renderRadio({ variables: source, value: 'bars' });

    await userEvent.click(screen.getByRole('button', { name: 'Use variable' }));
    await userEvent.click(await screen.findByRole('option', { name: /New variable with these values/ }));

    expect(source.createVariable).toHaveBeenCalledWith({
      name: 'drawStyle',
      type: 'custom',
      values: [
        { value: 'line', label: 'Lines' },
        { value: 'bars', label: 'Bars' },
        { value: 'points', label: 'Points' },
      ],
      current: 'bars',
    });
    expect(onChange).toHaveBeenCalledWith('${drawStyle}');
  });

  it('offers no new variable once one named after the property exists, which is listed instead', async () => {
    const drawStyle = { name: 'drawStyle', current: 'line', values: [{ value: 'line', label: 'line' }] };
    const { source } = makeSource({}, [...variables, drawStyle]);
    const { onChange } = renderRadio({ variables: source });

    await userEvent.click(screen.getByRole('button', { name: 'Use variable' }));
    await userEvent.click(await screen.findByRole('option', { name: /^drawStyle/ }));

    expect(screen.queryByRole('option', { name: /New variable with these values/ })).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith('${drawStyle}');
  });

  it('offers no new variable when no value matches the stored one, so mapping it would change the panel', async () => {
    const { source } = makeSource({}, variables);
    renderRadio({ variables: source, value: undefined });

    await userEvent.click(screen.getByRole('button', { name: 'Use variable' }));
    await screen.findByRole('option', { name: /^style/ });

    expect(screen.queryByRole('option', { name: /New variable with these values/ })).not.toBeInTheDocument();
  });

  it('names the new variable apart from a same-named one with other values', async () => {
    const drawStyle = { name: 'drawStyle', current: 'x', values: [{ value: 'x', label: 'x' }] };
    const { source } = makeSource({}, [...variables, drawStyle, { name: 'drawStyle_2', current: 'q' }]);
    const { onChange } = renderRadio({ variables: source });

    await userEvent.click(screen.getByRole('button', { name: 'Use variable' }));
    expect(screen.queryByRole('option', { name: /Use existing variable/ })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('option', { name: /New variable with these values/ }));

    expect(source.createVariable).toHaveBeenCalledWith(expect.objectContaining({ name: 'drawStyle_3' }));
    expect(onChange).toHaveBeenCalledWith('${drawStyle_3}');
  });

  it('does not map a variable that could not be created', async () => {
    const { source } = makeSource({}, variables);
    jest.mocked(source.createVariable!).mockReturnValue(false);
    const { onChange } = renderRadio({ variables: source });

    await userEvent.click(screen.getByRole('button', { name: 'Use variable' }));
    await userEvent.click(await screen.findByRole('option', { name: /New variable with these values/ }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('only follows variable changes in variable mode', async () => {
    const { source } = makeSource({}, variables);
    renderRadio({ variables: source });

    expect(source.subscribe).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Use variable' }));
    expect(source.subscribe).toHaveBeenCalled();
  });

  it('creates a switch variable for a boolean, starting on the stored value', async () => {
    const { source } = makeSource({}, variables);
    const onChange = jest.fn();
    render(
      <VarMappingToggleEditor
        editor={getEditor('boolean')}
        kind="boolean"
        value={true}
        onChange={onChange}
        item={{ id: 'custom.axisBorderShow', name: 'Show border' }}
        context={{ data: [] }}
        id="border"
        variables={source}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Use variable' }));
    await userEvent.click(await screen.findByRole('option', { name: /New variable with these values/ }));

    expect(source.createVariable).toHaveBeenCalledWith({
      name: 'axisBorderShow',
      type: 'switch',
      values: [
        { value: 'true', label: 'On' },
        { value: 'false', label: 'Off' },
      ],
      current: 'true',
    });
    expect(onChange).toHaveBeenCalledWith('${axisBorderShow}');
  });

  it('offers no new variable for a slider', async () => {
    const { source } = makeSource({}, variables);
    render(
      <VarMappingToggleEditor
        editor={getEditor('slider')}
        kind="number"
        value={2}
        onChange={jest.fn()}
        item={{ id: 'custom.lineWidth', name: 'Line width', settings: { min: 0, max: 10, step: 1 } }}
        context={{ data: [] }}
        id="line-width"
        variables={source}
      />
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Use variable' }));
    await screen.findAllByRole('option');

    expect(screen.queryByRole('option', { name: /New variable with these values/ })).not.toBeInTheDocument();
  });
});

describe('getVarMappingToggleKind', () => {
  it('uses the toggle for selects, switches and numbers without the standard number editor', () => {
    expect(getVarMappingToggleKind({ editor: getEditor('radio') }, 'option')).toBe('option');
    expect(getVarMappingToggleKind({ editor: getEditor('boolean') }, 'boolean')).toBe('boolean');
    expect(getVarMappingToggleKind({ editor: getEditor('slider') }, 'number')).toBe('number');
    expect(getVarMappingToggleKind({ editor: getEditor('number') }, 'number')).toBeUndefined();
    expect(getVarMappingToggleKind({ editor: getEditor('unit') }, 'string')).toBeUndefined();
    expect(getVarMappingToggleKind({ editor: getEditor('slider') }, undefined)).toBeUndefined();
  });

  it("keeps a plugin's own editor for a number option", () => {
    const PluginEditor = () => null;
    expect(getVarMappingToggleKind({ editor: PluginEditor }, 'number')).toBe('number');
  });
});
