import React from 'react';
import { shallow } from 'enzyme';
import { Messages } from 'app/percona/settings/Settings.messages';
import { Diagnostics } from './Diagnostics';

describe('Diagnostics::', () => {
  it('Renders diagnostics correctly', () => {
    const {
      diagnostics: { action, label },
    } = Messages;
    const root = shallow(<Diagnostics />);

    expect(root.children().length).toBe(2);
    expect(root.find('[data-qa="diagnostics-label"]').childAt(0).text()).toBe(label);
    expect(root.find('[data-qa="diagnostics-button"]').find('span').text()).toBe(action);
  });
});
