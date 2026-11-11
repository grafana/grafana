import { screen, within } from '@testing-library/react';

import { type DataSourceInstanceSettings, type TransformerRegistryItem } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../../constants';
import { ds1SettingsMock, makeStackedMode, renderWithQueryEditorProvider } from '../testUtils';
import { type Transformation } from '../types';

import { StackedSection } from './StackedSection';
import { type StackedItem } from './utils';

// The editors and plugin-driven header buttons need datasource and plugin wiring that is out of
// scope here; this suite covers the stacked header's actions and per-item panels.
jest.mock('../QueryEditorRenderer', () => ({
  QueryEditorPanel: () => null,
}));

jest.mock('../TransformationEditorRenderer', () => ({
  TransformationEditorPanel: ({ showSupplementalDisplays }: { showSupplementalDisplays?: boolean }) =>
    showSupplementalDisplays ? <div data-testid="transformation-supplemental-displays" /> : null,
}));

jest.mock('../hooks/useQueryDatasource', () => ({
  useQueryDatasource: () => ({ queryDsData: { dsSettings: ds1SettingsMock }, queryDsLoading: false }),
}));

jest.mock('../Header/PluginActions', () => ({
  PluginActions: () => null,
}));

jest.mock('app/features/datasources/components/picker/DataSourcePicker', () => ({
  DataSourcePicker: ({ onChange }: { onChange: (ds: DataSourceInstanceSettings) => void }) => (
    <button onClick={() => onChange(ds1SettingsMock)}>Change data source</button>
  ),
}));

jest.mock('../Header/DatasourceHelpPanel', () => ({
  DatasourceHelpPanel: () => <div data-testid="datasource-help-panel" />,
}));

const queryA: DataQuery = { refId: 'A', datasource: { type: 'test', uid: 'test' } };
const queryB: DataQuery = { refId: 'B', datasource: { type: 'test', uid: 'test' } };

const transformation: Transformation = {
  transformId: 'organize-0',
  transformConfig: { id: 'organize', options: {} },
  registryItem: { id: 'organize', name: 'Organize fields', editor: () => null } as unknown as TransformerRegistryItem,
};

const items: StackedItem[] = [
  { type: QueryEditorType.Query, id: 'A', query: queryA },
  { type: QueryEditorType.Query, id: 'B', query: queryB },
  { type: QueryEditorType.Transformation, id: 'organize-0', transformation },
];

type RenderOptions = NonNullable<Parameters<typeof renderWithQueryEditorProvider>[1]>;

function renderSections({ currentId = 'A', ...options }: RenderOptions & { currentId?: string } = {}) {
  return renderWithQueryEditorProvider(
    <>
      {items.map((item) => (
        <StackedSection key={item.id} item={item} isCurrent={item.id === currentId} headingId={`heading-${item.id}`} />
      ))}
    </>,
    {
      queries: [queryA, queryB],
      transformations: [transformation],
      selectedQuery: queryA,
      ...options,
      uiStateOverrides: { stackedMode: makeStackedMode({ enabled: true }), ...options.uiStateOverrides },
    }
  );
}

function getSection(id: string) {
  const section = screen.getAllByRole('region').find((el) => el.getAttribute('data-stacked-editor-item-id') === id);
  if (!section) {
    throw new Error(`No stacked section for ${id}`);
  }
  return section;
}

describe('StackedSection header actions', () => {
  it('hides, duplicates and removes the query in that section, not the selected one', async () => {
    const toggleQueryHide = jest.fn();
    const duplicateQuery = jest.fn();
    const deleteQuery = jest.fn();
    const { user } = renderSections({ actionsOverrides: { toggleQueryHide, duplicateQuery, deleteQuery } });
    const sectionB = within(getSection('B'));

    await user.click(sectionB.getByRole('button', { name: 'Hide Query' }));
    expect(toggleQueryHide).toHaveBeenCalledWith('B');

    await user.click(sectionB.getByRole('button', { name: /more query actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /duplicate query/i }));
    expect(duplicateQuery).toHaveBeenCalledWith('B');

    await user.click(sectionB.getByRole('button', { name: 'Remove Query' }));
    await user.click(sectionB.getByRole('button', { name: /confirm/i }));
    expect(deleteQuery).toHaveBeenCalledWith('B');
  });

  it('changes the data source of the query in that section', async () => {
    const changeDataSource = jest.fn();
    const { user } = renderSections({ actionsOverrides: { changeDataSource } });

    await user.click(within(getSection('B')).getByRole('button', { name: 'Change data source' }));

    expect(changeDataSource).toHaveBeenCalledWith(ds1SettingsMock, 'B');
  });

  it('disables the transformation in that section', async () => {
    const toggleTransformationDisabled = jest.fn();
    const { user } = renderSections({ actionsOverrides: { toggleTransformationDisabled } });

    await user.click(within(getSection('organize-0')).getByRole('button', { name: 'Disable Transformation' }));

    expect(toggleTransformationDisabled).toHaveBeenCalledWith('organize-0');
  });

  it('names each section after its item rather than its header controls', () => {
    renderSections();

    expect(getSection('A')).toHaveAccessibleName('Query A, Test DS');
    expect(getSection('B')).toHaveAccessibleName('Query B, Test DS');
    expect(getSection('organize-0')).toHaveAccessibleName('Transformation Organize fields');
  });

  it('shows data source help only in the current section', () => {
    renderSections({ currentId: 'B', selectedQuery: queryB, uiStateOverrides: { showingDatasourceHelp: true } });

    expect(within(getSection('B')).getByTestId('datasource-help-panel')).toBeInTheDocument();
    expect(within(getSection('A')).queryByTestId('datasource-help-panel')).not.toBeInTheDocument();
  });

  it('renders transformation help and debug displays only for the current transformation', () => {
    const { unmount } = renderSections({ currentId: 'A' });
    expect(screen.queryByTestId('transformation-supplemental-displays')).not.toBeInTheDocument();
    unmount();

    renderSections({ currentId: 'organize-0', selectedQuery: null, selectedTransformation: transformation });
    expect(within(getSection('organize-0')).getByTestId('transformation-supplemental-displays')).toBeInTheDocument();
  });
});
