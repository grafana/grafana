import { shallow } from 'enzyme';
import React from 'react';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';

import { NavModel } from '@grafana/data';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';

import { FolderSettingsPage, Props } from './FolderSettingsPage';
import { setFolderTitle } from './state/reducers';

const setup = (propOverrides?: object) => {
  const props: Props = {
    ...getRouteComponentProps(),
    pageNav: {} as NavModel,
    folderUid: '1234',
    folder: {
      id: 0,
      uid: '1234',
      title: 'loading',
      canSave: true,
      canDelete: true,
      url: 'url',
      hasChanged: false,
      version: 1,
      permissions: [],
      canViewFolderPermissions: true,
    },
    getFolderByUid: jest.fn(),
    setFolderTitle: mockToolkitActionCreator(setFolderTitle),
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
        canDelete: true,
        hasChanged: true,
        version: 1,
      },
    });
    expect(wrapper).toMatchSnapshot();
  });
});
