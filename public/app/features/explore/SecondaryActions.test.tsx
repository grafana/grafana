import { render, screen } from '@testing-library/react';
import { noop } from 'lodash';
import React from 'react';

import { SecondaryActions } from './SecondaryActions';

// TODO: remove!
const queryInspectorButtonSelector = '[aria-label="Query inspector button"]';

describe('SecondaryActions', () => {
  it('should render component with three buttons', () => {
    render(
      <SecondaryActions
        onClickAddQueryRowButton={noop}
        onClickRichHistoryButton={noop}
        onClickQueryInspectorButton={noop}
      />
    );

    expect(screen.getByRole('button', { name: /Add row button/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rich history button/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Query inspector button/i })).toBeInTheDocument();
  });

  it('should not render add row button if addQueryRowButtonHidden=true', () => {
    render(
      <SecondaryActions
        addQueryRowButtonHidden={true}
        onClickAddQueryRowButton={noop}
        onClickRichHistoryButton={noop}
        onClickQueryInspectorButton={noop}
      />
    );

    expect(screen.queryByRole('button', { name: /Add row button/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rich history button/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Query inspector button/i })).toBeInTheDocument();
  });

  it('should disable add row button if addQueryRowButtonDisabled=true', () => {
    render(
      <SecondaryActions
        addQueryRowButtonHidden={true}
        onClickAddQueryRowButton={noop}
        onClickRichHistoryButton={noop}
        onClickQueryInspectorButton={noop}
      />
    );
    // TODO: Continue here
    // expect(screen.queryByRole('button', { name: /Add row button/i })).toHaveAttribute('disabled');

    // expect(wrapper.find(addQueryRowButtonSelector).props().disabled).toBe(true);
  });

  // it('should map click handlers correctly', () => {
  //   const onClickAddRow = jest.fn();
  //   const onClickHistory = jest.fn();
  //   const onClickQueryInspector = jest.fn();
  //   const wrapper = shallow(
  //     <SecondaryActions
  //       onClickAddQueryRowButton={onClickAddRow}
  //       onClickRichHistoryButton={onClickHistory}
  //       onClickQueryInspectorButton={onClickQueryInspector}
  //     />
  //   );
  //
  //   wrapper.find(addQueryRowButtonSelector).simulate('click');
  //   expect(onClickAddRow).toBeCalled();
  //
  //   wrapper.find(richHistoryButtonSelector).simulate('click');
  //   expect(onClickHistory).toBeCalled();
  //
  //   wrapper.find(queryInspectorButtonSelector).simulate('click');
  //   expect(onClickQueryInspector).toBeCalled();
  // });
});
