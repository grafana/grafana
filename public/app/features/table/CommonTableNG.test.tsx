import { OpenFeatureTestProvider } from '@openfeature/react-sdk';
import { render, screen } from '@testing-library/react';

import { createDataFrame, createTheme, FieldType } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { mockClientSize } from '@grafana/test-utils';

import { CommonTableNG } from './CommonTableNG';

beforeAll(() => {
  mockClientSize({ width: 800, height: 600 });
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
      <CommonTableNG data={data} width={800} height={400} />
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
