import { dataQa } from '@percona/platform-core';
import { shallow } from 'enzyme';
import React from 'react';

import { SecretToggler } from 'app/percona/shared/components/Elements/SecretToggler';

import { KeysBlock } from './KeysBlock';
import { Messages } from './KeysBlock.messages';

describe('KeysBlock', () => {
  it('should have access key next to label', () => {
    const wrapper = shallow(<KeysBlock accessKey="access" secretKey="secret" />);
    expect(wrapper.find(dataQa('access-key')).text()).toBe(`${Messages.accessKey}access`);
  });

  it('should have SecretToggler with secret passed', () => {
    const wrapper = shallow(<KeysBlock accessKey="access" secretKey="secret" />);
    expect(wrapper.find(SecretToggler).prop('secret')).toBe('secret');
  });
});
