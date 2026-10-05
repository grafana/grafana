import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { render, screen } from '@testing-library/react';

import { applyFieldOverrides, createTheme, FieldType, toDataFrame } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { mockClientSize } from '@grafana/test-utils';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';

import { CommonTableNG } from './CommonTableNG';

beforeAll(() => mockClientSize({ width: 800, height: 600 }));
afterEach(() => setTestFlags({}));

it.each([
  [false, false, false],
  [false, true, false],
  [true, false, false],
  [true, true, true],
])('gates JSON highlighting with refresh=%s and newFeatures=%s', async (refresh, newFeatures, highlighted) => {
  setTestFlags({ [FlagKeys.TableRefresh]: refresh, [FlagKeys.TableRefreshNewFeatures]: newFeatures });
  const theme = createTheme();
  const [data] = applyFieldOverrides({
    data: [toDataFrame({ fields: [{ name: 'metadata', type: FieldType.other, values: [{ region: 'west' }] }] })],
    fieldConfig: { defaults: {}, overrides: [] },
    theme,
    replaceVariables: (value) => value,
    timeZone: 'utc',
  });
  render(
    <OpenFeatureProvider client={getTestFeatureFlagClient()}>
      <CommonTableNG data={data} width={800} height={400} />
    </OpenFeatureProvider>
  );
  expect(await screen.findByRole('gridcell', { name: /west/ })).toHaveTextContent('"region": "west"');
  if (highlighted) {
    expect(await screen.findByText('"west"')).toHaveStyle({ color: theme.components.codeEditor.string });
  } else {
    expect(screen.queryByText('"west"')).not.toBeInTheDocument();
  }
});
