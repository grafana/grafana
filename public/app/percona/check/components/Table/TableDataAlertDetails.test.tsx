import React from 'react';
import { shallow } from 'enzyme';
import { activeCheckStub } from 'app/percona/check/__mocks__/stubs';
import { SilenceAlertButton } from 'app/percona/check/components';
import { TableDataAlertDetails } from 'app/percona/check/components/Table';
import { SEVERITY } from 'app/percona/check/CheckPanel.constants';
import { Messages } from '../../CheckPanel.messages';



describe('TableDataAlertDetails::', () => {
  it('should correctly render the severity level', () => {
    const detailsItem = activeCheckStub[0].details[0];

    const root = shallow(<TableDataAlertDetails detailsItem={detailsItem} />);

    expect(
      root
        .find('td')
        .at(0)
        .text()
    ).toEqual(SEVERITY[detailsItem.labels.severity]);
  });

  it('should correctly render the description', () => {
    const detailsItem = activeCheckStub[0].details[0];

    const root = shallow(<TableDataAlertDetails detailsItem={detailsItem} />);

    expect(
      root
        .find('td')
        .at(1)
        .text()
    ).toEqual(`${detailsItem.description} - ${Messages.readMore}`);
  });

  it('should show a silence alert button', () => {
    const detailsItem = activeCheckStub[0].details[0];

    const root = shallow(<TableDataAlertDetails detailsItem={detailsItem} />);

    expect(
      root
        .find('td')
        .at(2)
        .find(SilenceAlertButton)
    ).toHaveLength(1);
  });

  it('shows a text for silenced alerts', () => {
    const detailsItem = activeCheckStub[3].details[0];

    const root = shallow(<TableDataAlertDetails detailsItem={detailsItem} />);

    expect(
      root
        .find('td')
        .at(2)
        .find(SilenceAlertButton)
    ).toHaveLength(0);
    expect(
      root
        .find('td')
        .at(2)
        .text()
    ).toEqual(Messages.silenced);
  });

  it('shows a text for silenced alerts', () => {
    const detailsItem = activeCheckStub[3].details[0];

    const root = shallow(<TableDataAlertDetails detailsItem={detailsItem} />);

    expect(
      root
        .find('td')
        .at(2)
        .find(SilenceAlertButton)
    ).toHaveLength(0);
    expect(
      root
        .find('td')
        .at(2)
        .text()
    ).toEqual(Messages.silenced);
  });
});
