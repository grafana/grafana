import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  applyFieldOverrides,
  createTheme,
  type DataFrame,
  FieldType,
  type InterpolateFunction,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
  toDataFrame,
} from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { RenderMode, TextMode } from '../../panelcfg.gen';
import { findFmtReads } from '../fmtMigration';

import { FmtMigrationNotice } from './FmtMigrationNotice';

jest.mock('../fmtMigration', () => {
  const actual = jest.requireActual('../fmtMigration');
  return { ...actual, findFmtReads: jest.fn(actual.findFmtReads) };
});

standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

beforeEach(() => {
  setTestFlags({ [FlagKeys.TextNewFeatures]: true });
});

afterAll(() => {
  setTestFlags({});
});

function withDisplay(frames: DataFrame[]): DataFrame[] {
  return applyFieldOverrides({
    data: frames,
    fieldConfig: { defaults: {}, overrides: [] },
    replaceVariables: (value) => value,
    theme: createTheme(),
    timeZone: 'utc',
  });
}

const services = () =>
  withDisplay([
    toDataFrame({
      refId: 'A',
      fields: [
        { name: 'service', type: FieldType.string, values: ['checkout', 'search'] },
        { name: 'cpu', type: FieldType.number, values: [0.942, 0.12], config: { unit: 'percentunit' } },
      ],
    }),
  ]);

const identity: InterpolateFunction = (value) => value;

function setup({
  content,
  draft = content,
  mode = TextMode.Markdown,
  renderMode = RenderMode.Once,
  frames = services(),
  replaceVariables = identity,
}: {
  content: string;
  draft?: string;
  mode?: TextMode;
  renderMode?: RenderMode;
  frames?: DataFrame[];
  replaceVariables?: InterpolateFunction;
}) {
  const onConvert = jest.fn();
  render(
    <FmtMigrationNotice
      content={content}
      mode={mode}
      renderMode={renderMode}
      format="html"
      frames={frames}
      replaceVariables={replaceVariables}
      getDraft={() => draft}
      onConvert={onConvert}
    />
  );
  return { onConvert, user: userEvent.setup() };
}

describe('FmtMigrationNotice', () => {
  it('says how many of the fmt reads can be converted', () => {
    setup({ content: '{{#each data}}{{fmt.cpu}}{{#each fmt}}{{this}}{{/each}}{{/each}}' });

    const notice = screen.getByRole('status', { name: 'fmt is deprecated' });
    expect(notice).toHaveTextContent('1 of 2 expressions can be converted to the display helper.');
    expect(within(notice).getByRole('button', { name: 'Convert to display' })).toBeVisible();
  });

  it.each([
    { desc: 'a template without fmt', content: '{{#each data}}{{display "cpu"}}{{/each}}', mode: TextMode.Markdown },
    { desc: 'Code mode', content: '{{fmt.cpu}}', mode: TextMode.Code },
    { desc: 'fmt in an HTML comment only', content: '<!-- {{fmt.cpu}} -->', mode: TextMode.HTML },
  ])('shows nothing for $desc', ({ content, mode }) => {
    setup({ content, mode });

    expect(screen.queryByRole('status', { name: 'fmt is deprecated' })).not.toBeInTheDocument();
  });

  it('shows nothing while the text.newFeatures flag is off', () => {
    setTestFlags({ [FlagKeys.TextNewFeatures]: false });
    setup({ content: '{{#each data}}{{fmt.cpu}}{{/each}}' });

    expect(screen.queryByRole('status', { name: 'fmt is deprecated' })).not.toBeInTheDocument();
  });

  it('reviews each change with its line and applies the conversion', async () => {
    const content =
      '# Services\n{{#each data}}- {{service}}: {{fmt.cpu}}{{#if (eq fmt.service "search")}} *{{/if}}\n{{/each}}';
    const { onConvert, user } = setup({ content });

    await user.click(screen.getByRole('button', { name: 'Convert to display' }));

    const dialog = screen.getByRole('dialog', { name: 'Convert fmt to display' });
    expect(
      within(dialog).getByText('Converts 2 expressions. The panel renders the same for the current query results.')
    ).toBeVisible();
    expect(
      within(within(dialog).getByRole('list', { name: 'Changes' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual(['Line 2fmt.cpu→display "cpu"', 'Line 2fmt.service→(display "service")']);

    await user.click(within(dialog).getByRole('button', { name: 'Convert' }));

    expect(onConvert).toHaveBeenCalledWith(
      '# Services\n{{#each data}}- {{service}}: {{display "cpu"}}{{#if (eq (display "service") "search")}} *{{/if}}\n{{/each}}'
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows how display reads several properties of a value', async () => {
    const { user } = setup({ content: '{{#each data}}{{fmt.cpu}}{{/each}}' });

    await user.click(screen.getByRole('button', { name: 'Convert to display' }));

    expect(
      within(screen.getByRole('dialog')).getByText(
        'The display helper reads the formatted value, as in {{display "cpu"}}, and a block reads several of its properties, as in {{#display "cpu"}}{{text}}{{suffix}}{{/display}}.'
      )
    ).toBeVisible();
  });

  it('converts the draft as it is when the review opens, not the content it last analyzed', async () => {
    const { onConvert, user } = setup({
      content: '{{#each data}}{{fmt.cpu}}{{/each}}',
      draft: '{{#each data}}{{fmt.cpu}} {{fmt.service}}{{/each}}',
    });

    await user.click(screen.getByRole('button', { name: 'Convert to display' }));
    await user.click(screen.getByRole('button', { name: 'Convert' }));

    expect(onConvert).toHaveBeenCalledWith('{{#each data}}{{display "cpu"}} {{display "service"}}{{/each}}');
  });

  it('lists the reads it leaves, with their line and how to change them', async () => {
    const { user } = setup({ content: '# Fleet\n{{#each data}}{{#each fmt}}{{this}}{{/each}}{{/each}}' });

    await user.click(screen.getByRole('button', { name: 'Show where it is used' }));

    const dialog = screen.getByRole('dialog', { name: 'Convert fmt to display' });
    expect(within(dialog).getByText('1 expression stays as it is')).toBeVisible();
    expect(within(dialog).getByRole('list', { name: 'Unchanged expressions' })).toHaveTextContent(
      'Line 2fmtReads fmt as a whole. Read each field with display instead, as in {{display "cpu"}}.'
    );
    expect(within(dialog).queryByRole('button', { name: 'Convert' })).not.toBeInTheDocument();
  });

  it('says how to convert a read where a block param hides the display helper', async () => {
    const { user } = setup({ content: '{{#each data as |display|}}{{fmt.cpu}}{{/each}}' });

    await user.click(screen.getByRole('button', { name: 'Show where it is used' }));

    expect(within(screen.getByRole('list', { name: 'Unchanged expressions' })).getByRole('listitem')).toHaveTextContent(
      'Line 1fmt.cpuA block parameter named display hides the helper here. Rename the block parameter, then use display.'
    );
  });

  it('does not apply a conversion when the template renders differently for the current query results', async () => {
    const frames = withDisplay([toDataFrame({ fields: [{ name: 'cpu', type: FieldType.number, values: [0.5] }] })]);
    let calls = 0;
    frames[0].fields[0].display = () => ({ text: ++calls === 2 ? 'changed' : 'same', numeric: 0.5 });
    const { onConvert, user } = setup({ content: '{{fmt.cpu}}', renderMode: RenderMode.PerRow, frames });

    await user.click(screen.getByRole('button', { name: 'Convert to display' }));

    const dialog = screen.getByRole('dialog', { name: 'Convert fmt to display' });
    expect(
      within(dialog).getByText(
        'The converted template renders differently for the current query results, so it is not applied'
      )
    ).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Convert' })).toBeDisabled();
    expect(onConvert).not.toHaveBeenCalled();
  });

  it('does not apply a conversion when the template renders differently every time, which it cannot check', async () => {
    let renders = 0;
    const { onConvert, user } = setup({
      content: '{{#each data}}{{fmt.cpu}}{{/each}}',
      replaceVariables: (value) => `${value}${renders++}`,
    });

    await user.click(screen.getByRole('button', { name: 'Convert to display' }));

    const dialog = screen.getByRole('dialog', { name: 'Convert fmt to display' });
    expect(
      within(dialog).getByText(
        'The template renders differently every time, for example with the current time, so the conversion cannot be checked and is not applied'
      )
    ).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Convert' })).toBeDisabled();
    expect(onConvert).not.toHaveBeenCalled();
  });

  it('applies a conversion when only the time of day moved on between renders', async () => {
    let renders = 0;
    const { onConvert, user } = setup({
      content: '{{#each data}}{{fmt.cpu}}{{/each}}',
      replaceVariables: (value) => `${value}${renders++ === 0 ? 'before' : 'after'}`,
    });

    await user.click(screen.getByRole('button', { name: 'Convert to display' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Convert' }));

    expect(onConvert).toHaveBeenCalledWith('{{#each data}}{{display "cpu"}}{{/each}}');
  });

  it('renders nothing to check when no read can be converted', async () => {
    const replaceVariables = jest.fn(identity);
    const { user } = setup({ content: '{{#each data}}{{#each fmt}}{{this}}{{/each}}{{/each}}', replaceVariables });

    await user.click(screen.getByRole('button', { name: 'Show where it is used' }));

    expect(screen.getByRole('dialog', { name: 'Convert fmt to display' })).toBeVisible();
    expect(replaceVariables).not.toHaveBeenCalled();
  });

  it('checks every frame for a field displayed as fmt, including those the panel does not show', async () => {
    const frames = withDisplay([
      ...services(),
      toDataFrame({ refId: 'B', fields: [{ name: 'fmt', type: FieldType.string, values: ['json'] }] }),
    ]);
    const { user } = setup({ content: '{{#each data}}{{fmt.cpu}}{{/each}}', frames });

    expect(screen.getByRole('status', { name: 'fmt is deprecated' })).toHaveTextContent(
      '0 of 1 expression can be converted to the display helper.'
    );

    await user.click(screen.getByRole('button', { name: 'Show where it is used' }));

    expect(within(screen.getByRole('listitem')).getByText(/A field is displayed as fmt/)).toBeVisible();
  });

  it('asks for query results before it converts, so the fields can be checked', () => {
    setup({ content: '{{fmt.cpu}}', renderMode: RenderMode.PerRow, frames: [] });

    expect(screen.getByRole('status', { name: 'fmt is deprecated' })).toHaveTextContent(
      'Run the query so the fields can be checked, then convert it to the display helper.'
    );
    expect(screen.queryByRole('button', { name: 'Convert to display' })).not.toBeInTheDocument();
  });

  it('checks the template again when it changes, not each time the query runs', () => {
    const content = '{{#each data}}{{fmt.cpu}}{{/each}}';
    const notice = (frames: DataFrame[], template = content) => (
      <FmtMigrationNotice
        content={template}
        mode={TextMode.Markdown}
        renderMode={RenderMode.Once}
        format="html"
        frames={frames}
        replaceVariables={identity}
        getDraft={() => template}
        onConvert={jest.fn()}
      />
    );
    const { rerender } = render(notice(services()));
    jest.mocked(findFmtReads).mockClear();

    rerender(notice(services()));
    expect(findFmtReads).not.toHaveBeenCalled();

    rerender(notice(withDisplay([...services(), toDataFrame({ fields: [{ name: 'fmt', values: ['json'] }] })])));
    expect(findFmtReads).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status', { name: 'fmt is deprecated' })).toHaveTextContent(
      '0 of 1 expression can be converted to the display helper.'
    );

    rerender(notice(services(), `${content} `));
    expect(findFmtReads).toHaveBeenCalledTimes(2);
  });

  it('hides the notice once it is dismissed', async () => {
    const { user } = setup({ content: '{{#each data}}{{fmt.cpu}}{{/each}}' });

    await user.click(screen.getByRole('button', { name: 'Close alert' }));

    expect(screen.queryByRole('status', { name: 'fmt is deprecated' })).not.toBeInTheDocument();
  });
});
