import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { noop } from 'lodash';

import { render } from '../../../test/test-utils';

import { QueriesDrawerContextProviderMock } from './QueriesDrawer/mocks';
import { QueryLibraryContextProviderMock } from './QueryLibrary/mocks';
import { SecondaryActions } from './SecondaryActions';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: () => Promise.resolve({}),
    getList: () => [],
    getInstanceSettings: () => {},
  }),
}));

describe('SecondaryActions', () => {
  it('should render component with two buttons', () => {
    render(
      <QueryLibraryContextProviderMock>
        <SecondaryActions
          onClickAddQueryRowButton={noop}
          onClickQueryInspectorButton={noop}
          onSelectQueryFromLibrary={noop}
        />
      </QueryLibraryContextProviderMock>
    );

    expect(screen.getByRole('button', { name: /Add query/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Query inspector/i })).toBeInTheDocument();
  });

  it('should not render hidden elements', () => {
    render(
      <QueriesDrawerContextProviderMock queryLibraryEnabled={false}>
        <SecondaryActions
          addQueryRowButtonHidden={true}
          richHistoryRowButtonHidden={true}
          onClickAddQueryRowButton={noop}
          onClickQueryInspectorButton={noop}
          onSelectQueryFromLibrary={noop}
        />
      </QueriesDrawerContextProviderMock>
    );

    expect(screen.queryByRole('button', { name: /Add query/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Query inspector/i })).toBeInTheDocument();
  });

  it('should disable add row button if addQueryRowButtonDisabled=true', () => {
    render(
      <SecondaryActions
        addQueryRowButtonDisabled={true}
        onClickAddQueryRowButton={noop}
        onClickQueryInspectorButton={noop}
        onSelectQueryFromLibrary={noop}
      />
    );

    expect(screen.getByRole('button', { name: /Add query/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Query inspector/i })).toBeInTheDocument();
  });

  it('should disable both add query buttons when addQueryRowButtonDisabled=true and saved queries is enabled', () => {
    render(
      <QueryLibraryContextProviderMock queryLibraryEnabled={true}>
        <SecondaryActions
          addQueryRowButtonDisabled={true}
          onClickAddQueryRowButton={noop}
          onClickQueryInspectorButton={noop}
          onSelectQueryFromLibrary={noop}
        />
      </QueryLibraryContextProviderMock>
    );

    expect(screen.getByRole('button', { name: /Add query$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Add from saved queries/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Query inspector/i })).toBeInTheDocument();
  });

  it('should map click handlers correctly', async () => {
    const user = userEvent.setup();

    const onClickAddRow = jest.fn();
    const onClickHistory = jest.fn();
    const onClickQueryInspector = jest.fn();

    render(
      <QueriesDrawerContextProviderMock setDrawerOpened={onClickHistory}>
        <SecondaryActions
          onClickAddQueryRowButton={onClickAddRow}
          onClickQueryInspectorButton={onClickQueryInspector}
          onSelectQueryFromLibrary={noop}
        />
      </QueriesDrawerContextProviderMock>
    );

    await user.click(screen.getByRole('button', { name: /Add query/i }));
    expect(onClickAddRow).toBeCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Query inspector/i }));
    expect(onClickQueryInspector).toBeCalledTimes(1);
  });

  it('should render add from saved queries button when saved queries is enabled', () => {
    render(
      <QueryLibraryContextProviderMock queryLibraryEnabled={true}>
        <SecondaryActions
          onClickAddQueryRowButton={noop}
          onClickQueryInspectorButton={noop}
          onSelectQueryFromLibrary={noop}
        />
      </QueryLibraryContextProviderMock>
    );

    expect(screen.getByRole('button', { name: /Add from saved queries/i })).toBeInTheDocument();
  });

  it('should not render add from saved queries button when saved queries is disabled', () => {
    render(
      <QueryLibraryContextProviderMock queryLibraryEnabled={false}>
        <SecondaryActions
          onClickAddQueryRowButton={noop}
          onClickQueryInspectorButton={noop}
          onSelectQueryFromLibrary={noop}
        />
      </QueryLibraryContextProviderMock>
    );

    expect(screen.queryByRole('button', { name: /Add from saved queries/i })).not.toBeInTheDocument();
  });
});
