import { OpenFeatureTestProvider } from '@openfeature/react-sdk';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createDataFrame, createTheme, FieldType } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { mockClientSize } from '@grafana/test-utils';

import { CommonTableNG } from './CommonTableNG';

beforeAll(() => {
  mockClientSize({ width: 800, height: 600 });
});

it.each([false, true])('opens inspected JSON strings with new features=%s', async (enabled) => {
  const data = createDataFrame({
    fields: [
      {
        name: 'message',
        type: FieldType.string,
        values: ['{"count":42}'],
        config: { custom: { inspect: true } },
        display: () => ({ text: '{"count":42}', numeric: NaN }),
      },
    ],
  });
  render(
    <OpenFeatureTestProvider
      flagValueMap={{ [FlagKeys.TableRefresh]: true, [FlagKeys.TableRefreshNewFeatures]: enabled }}
    >
      <CommonTableNG data={data} width={800} height={400} timeZone="UTC" />
    </OpenFeatureTestProvider>
  );
  screen.getByRole('button', { name: 'Cell actions' }).focus();
  await userEvent.keyboard('{Enter}');
  await userEvent.click(screen.getByRole('menuitem', { name: 'Inspect value' }));
  expect(screen.getByRole('tab', { name: enabled ? 'Code editor' : 'Plain text' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  if (enabled) {
    await userEvent.click(screen.getByRole('tab', { name: 'Plain text' }));
  }
  expect(screen.getByRole('dialog').querySelector('pre')?.textContent).toBe(
    enabled ? '{\n  "count": 42\n}' : '{"count":42}'
  );
});

it.each([false, true])('gates JSON highlighting with new table features=%s', async (enabled) => {
  const theme = createTheme();
  const data = createDataFrame({
    fields: [
      {
        name: 'JSON',
        type: FieldType.other,
        values: [{ count: 42 }],
        display: () => ({ text: '{"count":42}', numeric: NaN }),
      },
    ],
  });
  render(
    <OpenFeatureTestProvider flagValueMap={{ [FlagKeys.TableRefreshNewFeatures]: enabled }}>
      <CommonTableNG data={data} width={800} height={400} timeZone="UTC" />
    </OpenFeatureTestProvider>
  );
  const cell = await screen.findByRole('gridcell', { name: /count/ });
  expect(cell).toHaveTextContent('{ "count": 42 }');
  if (enabled) {
    expect(await screen.findByText('42')).toHaveStyle({ color: theme.components.codeEditor.number });
  } else {
    expect(cell.querySelector('span[style*="color"]')).not.toBeInTheDocument();
  }
});
