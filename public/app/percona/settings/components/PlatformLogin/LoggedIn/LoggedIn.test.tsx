import React from 'react';
import { mount, shallow } from 'enzyme';
import { Button } from '@grafana/ui';
import { LoggedIn } from './LoggedIn';
import { PlatformLoginService } from '../PlatformLogin.service';



describe('LoggedIn::', () => {
  it('Should show the passed email correctly', () => {
    const testEmail = 'test@email';
    const root = shallow(<LoggedIn email={testEmail} getSettings={() => {}} />);

    expect(root.find('[data-qa="logged-in-email"]').text()).toEqual(testEmail);
  });

  it('Should update settings ', async () => {
    const testEmail = 'test@email';
    const fakeGetSettings = jest.fn();

    jest.spyOn(PlatformLoginService, 'signOut');

    const root = mount(<LoggedIn email={testEmail} getSettings={fakeGetSettings} />);

    expect(PlatformLoginService.signOut).toBeCalledTimes(0);

    root
      .find(Button)
      .at(0)
      .simulate('click');

    expect(PlatformLoginService.signOut).toBeCalledTimes(1);
  });
});
