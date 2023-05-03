import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import selectEvent from 'react-select-event';

import { selectors } from '@grafana/e2e-selectors';
import { contextSrv } from 'app/core/core';
import * as api from 'app/features/manage-dashboards/state/actions';

import { DashboardSearchHit } from '../../../features/search/types';

import { FolderPicker, getInitialValues } from './FolderPicker';

describe('FolderPicker', () => {
  it('should render', async () => {
    jest
      .spyOn(api, 'searchFolders')
      .mockResolvedValue([
        { title: 'Dash 1', uid: 'xMsQdBfWz' } as DashboardSearchHit,
        { title: 'Dash 2', uid: 'wfTJJL5Wz' } as DashboardSearchHit,
      ]);

    render(<FolderPicker onChange={jest.fn()} />);
    expect(await screen.findByTestId(selectors.components.FolderPicker.containerV2)).toBeInTheDocument();
  });

  it('Should apply filter to the folders search results', async () => {
    jest
      .spyOn(api, 'searchFolders')
      .mockResolvedValue([
        { title: 'Dash 1', uid: 'xMsQdBfWz' } as DashboardSearchHit,
        { title: 'Dash 2', uid: 'wfTJJL5Wz' } as DashboardSearchHit,
        { title: 'Dash 3', uid: '7MeksYbmk' } as DashboardSearchHit,
      ]);

    render(<FolderPicker onChange={jest.fn()} filter={(hits) => hits.filter((h) => h.uid !== 'wfTJJL5Wz')} />);

    const pickerContainer = screen.getByLabelText(selectors.components.FolderPicker.input);
    selectEvent.openMenu(pickerContainer);

    const pickerOptions = await screen.findAllByLabelText('Select option');

    expect(pickerOptions).toHaveLength(2);
    expect(pickerOptions[0]).toHaveTextContent('Dash 1');
    expect(pickerOptions[1]).toHaveTextContent('Dash 3');
  });

  it('should allow creating a new option', async () => {
    const newFolder = { title: 'New Folder', uid: '7MeksYbmk' } as DashboardSearchHit;

    jest
      .spyOn(api, 'searchFolders')
      .mockResolvedValue([
        { title: 'Dash 1', uid: 'xMsQdBfWz' } as DashboardSearchHit,
        { title: 'Dash 2', uid: 'wfTJJL5Wz' } as DashboardSearchHit,
      ]);

    const onChangeFn = jest.fn();

    const create = jest.spyOn(api, 'createFolder').mockResolvedValue(newFolder);

    render(<FolderPicker onChange={onChangeFn} enableCreateNew={true} allowEmpty={true} />);
    expect(await screen.findByTestId(selectors.components.FolderPicker.containerV2)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Select a folder'), newFolder.title);
    const enter = await screen.findByText('Hit enter to add');

    await userEvent.click(enter);
    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({ title: newFolder.title });
    });

    expect(onChangeFn).toHaveBeenCalledWith({ title: newFolder.title, uid: newFolder.uid });
    await waitFor(() => {
      expect(screen.getByText(newFolder.title)).toBeInTheDocument();
    });
  });

  it('should show the General folder by default for editors', async () => {
    jest
      .spyOn(api, 'searchFolders')
      .mockResolvedValue([
        { title: 'Dash 1', uid: 'xMsQdBfWz' } as DashboardSearchHit,
        { title: 'Dash 2', uid: 'wfTJJL5Wz' } as DashboardSearchHit,
      ]);

    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(true);

    const onChangeFn = jest.fn();
    render(<FolderPicker onChange={onChangeFn} />);
    expect(await screen.findByTestId(selectors.components.FolderPicker.containerV2)).toBeInTheDocument();
    const pickerContainer = screen.getByLabelText(selectors.components.FolderPicker.input);
    selectEvent.openMenu(pickerContainer);

    const pickerOptions = await screen.findAllByLabelText('Select option');

    expect(pickerOptions[0]).toHaveTextContent('General');
  });

  it('should not show the General folder by default if showRoot is false', async () => {
    jest
      .spyOn(api, 'searchFolders')
      .mockResolvedValue([
        { title: 'Dash 1', uid: 'xMsQdBfWz' } as DashboardSearchHit,
        { title: 'Dash 2', uid: 'wfTJJL5Wz' } as DashboardSearchHit,
      ]);

    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(true);

    const onChangeFn = jest.fn();
    render(<FolderPicker onChange={onChangeFn} showRoot={false} />);
    expect(await screen.findByTestId(selectors.components.FolderPicker.containerV2)).toBeInTheDocument();
    const pickerContainer = screen.getByLabelText(selectors.components.FolderPicker.input);
    selectEvent.openMenu(pickerContainer);

    const pickerOptions = await screen.findAllByLabelText('Select option');

    expect(pickerOptions[0]).not.toHaveTextContent('General');
  });

  it('should not show the General folder by default for not editors', async () => {
    jest
      .spyOn(api, 'searchFolders')
      .mockResolvedValue([
        { title: 'Dash 1', uid: 'xMsQdBfWz' } as DashboardSearchHit,
        { title: 'Dash 2', uid: 'wfTJJL5Wz' } as DashboardSearchHit,
      ]);

    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(false);

    const onChangeFn = jest.fn();
    render(<FolderPicker onChange={onChangeFn} />);
    expect(await screen.findByTestId(selectors.components.FolderPicker.containerV2)).toBeInTheDocument();
    const pickerContainer = screen.getByLabelText(selectors.components.FolderPicker.input);
    selectEvent.openMenu(pickerContainer);

    const pickerOptions = await screen.findAllByLabelText('Select option');

    expect(pickerOptions[0]).not.toHaveTextContent('General');
  });

  it('should return the correct search results when typing in the select', async () => {
    jest.spyOn(api, 'searchFolders').mockImplementation((query: string) => {
      return Promise.resolve(
        [
          { title: 'Dash Test', uid: 'xMsQdBfWz' } as DashboardSearchHit,
          { title: 'Dash Two', uid: 'wfTJJL5Wz' } as DashboardSearchHit,
        ].filter((dash) => dash.title.indexOf(query) > -1)
      );
    });
    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(false);
    const onChangeFn = jest.fn();
    render(<FolderPicker onChange={onChangeFn} />);

    const pickerContainer = screen.getByLabelText(selectors.components.FolderPicker.input);
    await userEvent.type(pickerContainer, 'Test');

    expect(await screen.findByText('Dash Test')).toBeInTheDocument();
    expect(screen.queryByText('Dash Two')).not.toBeInTheDocument();
  });
});

describe('getInitialValues', () => {
  describe('when called with folderUid and title', () => {
    it('then it should return folderUid and title', async () => {
      const getFolder = jest.fn().mockResolvedValue({});
      const folder = await getInitialValues({ folderUid: '', folderName: 'Some title', getFolder });

      expect(folder).toEqual({ label: 'Some title', value: '' });
      expect(getFolder).not.toHaveBeenCalled();
    });
  });

  describe('when called with just a folderUid', () => {
    it('then it should call api to retrieve title', async () => {
      const getFolder = jest.fn().mockResolvedValue({ uid: '', title: 'Title from api' });
      const folder = await getInitialValues({ folderUid: '', getFolder });

      expect(folder).toEqual({ label: 'Title from api', value: '' });
      expect(getFolder).toHaveBeenCalledTimes(1);
      expect(getFolder).toHaveBeenCalledWith('');
    });
  });

  describe('when called without folderUid', () => {
    it('then it should throw an error', async () => {
      const getFolder = jest.fn().mockResolvedValue({});
      await expect(getInitialValues({ getFolder })).rejects.toThrow();
    });
  });
});
