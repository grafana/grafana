import React from 'react';
import { shallow } from 'enzyme';

import { FolderPicker, getInitialValues } from './FolderPicker';
import * as api from 'app/features/manage-dashboards/state/actions';
import { DashboardSearchHit } from '../../../features/search/types';

describe('FolderPicker', () => {
  it('should render', () => {
    jest
      .spyOn(api, 'searchFolders')
      .mockResolvedValue([
        { title: 'Dash 1', id: 1 } as DashboardSearchHit,
        { title: 'Dash 2', id: 2 } as DashboardSearchHit,
      ]);
    const wrapper = shallow(<FolderPicker onChange={jest.fn()} />);
    expect(wrapper).toMatchSnapshot();
  });
});

describe('getInitialValues', () => {
  describe('when called with folderId and title', () => {
    it('then it should return folderId and title', async () => {
      const getFolder = jest.fn().mockResolvedValue({});
      const folder = await getInitialValues({ folderId: 0, folderName: 'Some title', getFolder });

      expect(folder).toEqual({ label: 'Some title', value: 0 });
      expect(getFolder).not.toHaveBeenCalled();
    });
  });

  describe('when called with just a folderId', () => {
    it('then it should call api to retrieve title', async () => {
      const getFolder = jest.fn().mockResolvedValue({ id: 0, title: 'Title from api' });
      const folder = await getInitialValues({ folderId: 0, getFolder });

      expect(folder).toEqual({ label: 'Title from api', value: 0 });
      expect(getFolder).toHaveBeenCalledTimes(1);
      expect(getFolder).toHaveBeenCalledWith(0);
    });
  });

  describe('when called without folderId', () => {
    it('then it should throw an error', async () => {
      const getFolder = jest.fn().mockResolvedValue({});
      await expect(getInitialValues({ getFolder })).rejects.toThrow();
    });
  });
});
