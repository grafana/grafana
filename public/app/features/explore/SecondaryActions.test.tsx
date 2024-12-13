import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { noop } from 'lodash';

import { QueriesDrawerContextProviderMock } from './QueriesDrawer/mocks';
import { SecondaryActions } from './SecondaryActions';

describe('SecondaryActions', () => {
  it('should render component with two buttons', () => {
    render(<SecondaryActions onClickAddQueryRowButton={noop} onClickQueryInspectorButton={noop} />);

    expect(screen.getByRole('button', { name: /Add query/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Query inspector/i })).toBeInTheDocument();
  });

  it('should not render hidden elements', () => {
    render(
      <QueriesDrawerContextProviderMock queryLibraryAvailable={false}>
        <SecondaryActions
          addQueryRowButtonHidden={true}
          richHistoryRowButtonHidden={true}
          onClickAddQueryRowButton={noop}
          onClickQueryInspectorButton={noop}
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
      />
    );

    expect(screen.getByRole('button', { name: /Add query/i })).toBeDisabled();
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
        />
      </QueriesDrawerContextProviderMock>
    );

    await user.click(screen.getByRole('button', { name: /Add query/i }));
    expect(onClickAddRow).toBeCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Query inspector/i }));
    expect(onClickQueryInspector).toBeCalledTimes(1);
  });
});
