import React from 'react';
import { ReactWrapper, shallow, ShallowWrapper } from 'enzyme';
import { AddInstance, SelectInstance } from './AddInstance';
import { instanceList } from './AddInstance.constants';
import { getMount } from 'app/percona/shared/helpers/testUtils';

jest.mock('app/percona/settings/Settings.service');

describe('AddInstance page::', () => {
  it('should render a given number of links', () => {
    const wrapper: ShallowWrapper = shallow(<AddInstance onSelectInstanceType={() => {}} />);

    expect(wrapper.find(SelectInstance).length).toEqual(instanceList.length);
  });

  it('should invoke a callback with a proper instance type', async () => {
    const onSelectInstanceType = jest.fn();

    const wrapper: ReactWrapper = await getMount(<AddInstance onSelectInstanceType={onSelectInstanceType} />);

    expect(onSelectInstanceType).toBeCalledTimes(0);

    wrapper.update();
    wrapper.find('[data-testid="rds-instance"]').simulate('click');

    expect(onSelectInstanceType).toBeCalledTimes(1);
    expect(onSelectInstanceType.mock.calls[0][0]).toStrictEqual({ type: 'rds' });
  });
});
