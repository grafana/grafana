import React from 'react';
import { AddPanelPanel } from './../dashgrid/AddPanelPanel';
import { PanelModel } from '../panel_model';
import { shallow } from 'enzyme';
import config from '../../../core/config';

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
      {
        id: 'singlestat',
        hideFromList: false,
        name: 'Singlestat',
        sort: 2,
        module: '',
        baseUrl: '',
        meta: {},
        info: {
          logos: {
            small: '',
          },
        },
      },
      {
        id: 'hidden',
        hideFromList: true,
        name: 'Hidden',
        sort: 100,
        meta: {},
        module: '',
        baseUrl: '',
        info: {
          logos: {
            small: '',
          },
        },
      },
      {
        id: 'graph',
        hideFromList: false,
        name: 'Graph',
        sort: 1,
        meta: {},
        module: '',
        baseUrl: '',
        info: {
          logos: {
            small: '',
          },
        },
      },
      {
        id: 'alexander_zabbix',
        hideFromList: false,
        name: 'Zabbix',
        sort: 100,
        meta: {},
        module: '',
        baseUrl: '',
        info: {
          logos: {
            small: '',
          },
        },
      },
      {
        id: 'piechart',
        hideFromList: false,
        name: 'Piechart',
        sort: 100,
        meta: {},
        module: '',
        baseUrl: '',
        info: {
          logos: {
            small: '',
          },
        },
      },
    ];

    dashboardMock = { toggleRow: jest.fn() };

    panel = new PanelModel({ collapsed: false });
    wrapper = shallow(<AddPanelPanel panel={panel} dashboard={dashboardMock} />);
  });

  it('should fetch all panels sorted with core plugins first', () => {
    //console.log(wrapper.debug());
    //console.log(wrapper.find('.add-panel__item').get(0).props.title);
    expect(wrapper.find('.add-panel__item').get(1).props.title).toBe('Singlestat');
    expect(wrapper.find('.add-panel__item').get(4).props.title).toBe('Piechart');
  });

  it('should filter', () => {
    wrapper.find('input').simulate('change', { target: { value: 'p' } });

    expect(wrapper.find('.add-panel__item').get(1).props.title).toBe('Piechart');
    expect(wrapper.find('.add-panel__item').get(0).props.title).toBe('Graph');
  });
});
