import React from 'react';
import { AddPanelPanel } from './../dashgrid/AddPanelPanel';
import { PanelModel } from '../panel_model';
import { shallow } from 'enzyme';
import config from '../../../core/config';
import { getPanelPlugin } from 'app/features/plugins/__mocks__/pluginMocks';

jest.mock('app/core/store', () => ({
  get: key => {
    return null;
  },
  delete: key => {
    return null;
  },
}));

describe('AddPanelPanel', () => {
  let wrapper, dashboardMock, panel;

  beforeEach(() => {
    config.panels = [
      getPanelPlugin({ id: 'singlestat', sort: 2 }),
      getPanelPlugin({ id: 'hidden', sort: 100, hideFromList: true }),
      getPanelPlugin({ id: 'graph', sort: 1 }),
      getPanelPlugin({ id: 'alexander_zabbix', sort: 100 }),
      getPanelPlugin({ id: 'piechart', sort: 100 }),
    ];

    dashboardMock = { toggleRow: jest.fn() };

    panel = new PanelModel({ collapsed: false });
    wrapper = shallow(<AddPanelPanel panel={panel} dashboard={dashboardMock} />);
  });

  it('should fetch all panels sorted with core plugins first', () => {
    expect(wrapper.find('.add-panel__item').get(1).props.title).toBe('singlestat');
    expect(wrapper.find('.add-panel__item').get(4).props.title).toBe('piechart');
  });

  it('should filter', () => {
    wrapper.find('input').simulate('change', { target: { value: 'p' } });

    expect(wrapper.find('.add-panel__item').get(1).props.title).toBe('piechart');
    expect(wrapper.find('.add-panel__item').get(0).props.title).toBe('graph');
  });
});
