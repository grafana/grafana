import { render, screen } from '@testing-library/react';

import { type DataSourceInstanceSettings, type DataSourcePluginMeta, type ScopedVars } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../../constants';
import { renderWithQueryEditorProvider } from '../testUtils';

import { ContentHeader, ContentHeaderSceneWrapper } from './ContentHeader';

// Capture the picker props so we can assert how `current` and `scopedVars` are resolved.
const mockDataSourcePicker = jest.fn();

jest.mock('app/features/datasources/components/picker/DataSourcePicker', () => ({
  DataSourcePicker: (props: { current?: unknown; scopedVars?: unknown }) => {
    mockDataSourcePicker(props);
    return null;
  },
}));

// Reads from QueryEditor context, which is out of scope for these header wiring tests.
jest.mock('./HeaderActions', () => ({ HeaderActions: () => null }));

const resolvedSettings: DataSourceInstanceSettings = {
  uid: '${metrics_source}',
  name: '${metrics_source}',
  type: 'prometheus',
  meta: { id: 'prometheus', name: 'Prometheus' } as DataSourcePluginMeta,
  access: 'proxy',
  jsonData: {},
  readOnly: false,
};

function renderHeader(
  query: DataQuery,
  props: { currentDatasource?: DataSourceInstanceSettings; scopedVars?: ScopedVars } = {}
) {
  return render(
    <ContentHeader
      selectedAlert={null}
      selectedQuery={query}
      selectedTransformation={null}
      queries={[query]}
      cardType={QueryEditorType.Query}
      onChangeDataSource={jest.fn()}
      onUpdateQuery={jest.fn()}
      {...props}
    />
  );
}

const pickerProps = () => mockDataSourcePicker.mock.lastCall?.[0];

describe('ContentHeader datasource picker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the resolved effective datasource for an inherited query (parity with v1)', () => {
    // The query has no explicit ref, so the picker must show the resolved datasource (a
    // section-scoped variable here) rather than falling back to the default — matching v1.
    renderHeader({ refId: 'A' }, { currentDatasource: resolvedSettings });

    expect(pickerProps().current).toBe(resolvedSettings);
  });

  it('falls back to the raw query datasource ref when no resolved datasource is provided', () => {
    const queryRef = { uid: '${metrics_source}', type: 'prometheus' };
    renderHeader({ refId: 'A', datasource: queryRef });

    expect(pickerProps().current).toBe(queryRef);
  });

  it('forwards the scene scope so the picker can resolve section-scoped variables', () => {
    // Without this the picker only sees dashboard-level variables and renders "Select data source"
    // for a row/tab-scoped datasource variable.
    const scopedVars: ScopedVars = { __sceneObject: { value: {} } };
    renderHeader({ refId: 'A' }, { scopedVars });

    expect(pickerProps().scopedVars).toBe(scopedVars);
  });
});

describe('ContentHeader query name', () => {
  it('stays editable while a bulk selection is active', () => {
    // The header describes the active card only, so a bulk selection elsewhere in the sidebar
    // is no reason to lock renaming.
    const query = { refId: 'A' };
    renderWithQueryEditorProvider(<ContentHeaderSceneWrapper />, {
      queries: [query, { refId: 'B' }],
      selectedQuery: query,
      uiStateOverrides: { multiSelectMode: true, selectedQueryRefIds: ['A', 'B'] },
    });

    expect(screen.getByRole('button', { name: 'Edit query name' })).toBeInTheDocument();
  });
});
