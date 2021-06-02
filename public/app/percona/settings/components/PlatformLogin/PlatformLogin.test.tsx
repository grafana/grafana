import React from 'react';
import { mount } from 'enzyme';
import { PlatformLogin } from './PlatformLogin';
import { LoggedIn } from './LoggedIn/LoggedIn';



describe('Platform login::', () => {
  it('Should show a login form if an undefined email is passed', () => {
    const root = mount(<PlatformLogin getSettings={jest.fn()} userEmail={undefined} />);
    const loggedInEmail = root.find(LoggedIn).at(0);
    const submitFrom = root.find('[data-qa="sign-in-form"]').at(0);

    expect(loggedInEmail).toHaveLength(0);
    expect(submitFrom).toHaveLength(1);
  });

  it('Should have the "Sign up" button when first rendered', () => {
    const root = mount(<PlatformLogin getSettings={jest.fn()} userEmail={undefined} />);
    const submitButton = root.find('[data-qa="sign-in-to-sign-up-button"]').at(0);

    expect(submitButton.props()).toHaveProperty('disabled');
  });

  it('Should show a page saying that the user is logged in if a not undefined email is passed', () => {
    const root = mount(<PlatformLogin getSettings={jest.fn()} userEmail="test@example.com" />);
    const loggedInEmail = root.find(LoggedIn).at(0);

    expect(loggedInEmail).toHaveLength(1);
  });
});
