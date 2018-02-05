import React from 'react';
import { FolderSettings } from './FolderSettings';
import { RootStore } from 'app/stores/RootStore/RootStore';
import { backendSrv } from 'test/mocks/common';
import { shallow } from 'enzyme';

describe('FolderSettings', () => {
  let wrapper;
  let page;

  beforeAll(() => {
    backendSrv.getDashboardByUid.mockReturnValue(
      Promise.resolve({
        dashboard: {
          id: 1,
          title: 'Folder Name',
          uid: 'uid-str',
        },
        meta: {
          url: '/dashboards/f/uid/folder-name',
          canSave: true,
        },
      })
    );

    const store = RootStore.create(
      {
        view: {
          path: 'asd',
          query: {},
          routeParams: {
            uid: 'uid-str',
          },
        },
      },
      {
        backendSrv: backendSrv,
      }
    );

    wrapper = shallow(<FolderSettings backendSrv={backendSrv} {...store} />);
    page = wrapper.dive();
    return page
      .instance()
      .loadStore()
      .then(() => {
        page.update();
      });
  });

  it('should set the title input field', () => {
    const titleInput = page.find('.gf-form-input');
    expect(titleInput).toHaveLength(1);
    expect(titleInput.prop('value')).toBe('Folder Name');
  });

  it('should update title and enable save button when changed', () => {
    const titleInput = page.find('.gf-form-input');
    const disabledSubmitButton = page.find('button[type="submit"]');
    expect(disabledSubmitButton.prop('disabled')).toBe(true);

    titleInput.simulate('change', { target: { value: 'New Title' } });

    const updatedTitleInput = page.find('.gf-form-input');
    expect(updatedTitleInput.prop('value')).toBe('New Title');
    const enabledSubmitButton = page.find('button[type="submit"]');
    expect(enabledSubmitButton.prop('disabled')).toBe(false);
  });

  it('should disable save button if title is changed back to old title', () => {
    const titleInput = page.find('.gf-form-input');

    titleInput.simulate('change', { target: { value: 'Folder Name' } });

    const enabledSubmitButton = page.find('button[type="submit"]');
    expect(enabledSubmitButton.prop('disabled')).toBe(true);
  });

  it('should disable save button if title is changed to empty string', () => {
    const titleInput = page.find('.gf-form-input');

    titleInput.simulate('change', { target: { value: '' } });

    const enabledSubmitButton = page.find('button[type="submit"]');
    expect(enabledSubmitButton.prop('disabled')).toBe(true);
  });
});
