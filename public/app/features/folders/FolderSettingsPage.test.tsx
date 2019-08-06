import React from 'react';
import { FolderSettingsPage, Props } from './FolderSettingsPage';
import { shallow } from 'enzyme';
import { NavModel } from '@grafana/data';

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {} as NavModel,
    folderUid: '1234',
    folder: {
      id: 0,
      uid: '1234',
      title: 'loading',
      canSave: true,
      url: 'url',
      hasChanged: false,
      version: 1,
      permissions: [],
    },
    getFolderByUid: jest.fn(),
    setFolderTitle: jest.fn(),
    saveFolder: jest.fn(),
    deleteFolder: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<FolderSettingsPage {...props} />);
  const instance = wrapper.instance() as FolderSettingsPage;

  return {
    wrapper,
    instance,
  };
};

describe('Render', () => {
  it('should render component', () => {
    const { wrapper } = setup();
    expect(wrapper).toMatchSnapshot();
  });

  it('should enable save button', () => {
    const { wrapper } = setup({
      folder: {
        id: 1,
        uid: '1234',
        title: 'loading',
        canSave: true,
        hasChanged: true,
        version: 1,
      },
    });
    expect(wrapper).toMatchSnapshot();
  });
});
