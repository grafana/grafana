import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { noop } from 'lodash';
import React from 'react';

import { SecondaryActions } from './SecondaryActions';

describe('SecondaryActions', () => {
  it('should render component with three buttons', () => {
    render(
      <SecondaryActions
        onClickAddQueryRowButton={noop}
        onClickRichHistoryButton={noop}
        onClickQueryInspectorButton={noop}
      />
    );

    expect(screen.getByRole('button', { name: /Add query/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Query history/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Query inspector/i })).toBeInTheDocument();
  });

  it('should not render hidden elements', () => {
    render(
      <SecondaryActions
        addQueryRowButtonHidden={true}
        richHistoryRowButtonHidden={true}
        onClickAddQueryRowButton={noop}
        onClickRichHistoryButton={noop}
        onClickQueryInspectorButton={noop}
      />
    );

    expect(screen.queryByRole('button', { name: /Add query/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Query history/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Query inspector/i })).toBeInTheDocument();
  });

  it('should disable add row button if addQueryRowButtonDisabled=true', () => {
    render(
      <SecondaryActions
        addQueryRowButtonDisabled={true}
        onClickAddQueryRowButton={noop}
        onClickRichHistoryButton={noop}
        onClickQueryInspectorButton={noop}
      />
    );

    expect(screen.getByRole('button', { name: /Add query/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Query history/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Query inspector/i })).toBeInTheDocument();
  });

  it('should map click handlers correctly', async () => {
    const user = userEvent.setup();

    const onClickAddRow = jest.fn();
    const onClickHistory = jest.fn();
    const onClickQueryInspector = jest.fn();

    render(
      <SecondaryActions
        onClickAddQueryRowButton={onClickAddRow}
        onClickRichHistoryButton={onClickHistory}
        onClickQueryInspectorButton={onClickQueryInspector}
      />
    );

    await user.click(screen.getByRole('button', { name: /Add query/i }));
    expect(onClickAddRow).toBeCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Query history/i }));
    expect(onClickHistory).toBeCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Query inspector/i }));
    expect(onClickQueryInspector).toBeCalledTimes(1);
  });
});
