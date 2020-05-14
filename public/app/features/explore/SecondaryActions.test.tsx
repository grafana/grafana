import React from 'react';
import { noop } from 'lodash';
import { shallow } from 'enzyme';
import { SecondaryActions } from './SecondaryActions';

const addQueryRowButtonSelector = '[aria-label="Add row button"]';
const richHistoryButtonSelector = '[aria-label="Rich history button"]';

describe('SecondaryActions', () => {
  it('should render component two buttons', () => {
    const wrapper = shallow(<SecondaryActions onClickAddQueryRowButton={noop} onClickRichHistoryButton={noop} />);
    expect(wrapper.find(addQueryRowButtonSelector)).toHaveLength(1);
    expect(wrapper.find(richHistoryButtonSelector)).toHaveLength(1);
  });

  it('should not render add row button if addQueryRowButtonHidden=true', () => {
    const wrapper = shallow(
      <SecondaryActions
        addQueryRowButtonHidden={true}
        onClickAddQueryRowButton={noop}
        onClickRichHistoryButton={noop}
      />
    );
    expect(wrapper.find(addQueryRowButtonSelector)).toHaveLength(0);
    expect(wrapper.find(richHistoryButtonSelector)).toHaveLength(1);
  });

  it('should disable add row button if addQueryRowButtonDisabled=true', () => {
    const wrapper = shallow(
      <SecondaryActions
        addQueryRowButtonDisabled={true}
        onClickAddQueryRowButton={noop}
        onClickRichHistoryButton={noop}
      />
    );
    expect(wrapper.find(addQueryRowButtonSelector).props().disabled).toBe(true);
  });

  it('should map click handlers correctly', () => {
    const onClickAddRow = jest.fn();
    const onClickHistory = jest.fn();
    const wrapper = shallow(
      <SecondaryActions onClickAddQueryRowButton={onClickAddRow} onClickRichHistoryButton={onClickHistory} />
    );
    wrapper.find(addQueryRowButtonSelector).simulate('click');
    expect(onClickAddRow).toBeCalled();

    wrapper.find(richHistoryButtonSelector).simulate('click');
    expect(onClickHistory).toBeCalled();
  });
});
