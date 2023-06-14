import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DataSourceDropdown } from './DataSourceDropdown';

const mockDS = {
  name: 'mockDS',
  uid: 'mockDSuid',
  meta: { name: 'mockDS', info: { logos: { small: 'mockLogoPath' } } },
};

const xMockDS = {
  name: 'xMockDS',
  uid: 'xMockDSuid',
  meta: { name: 'xMockDS', info: { logos: { small: 'xMockLogoPath' } } },
};

const mockDSList = [mockDS, xMockDS];

const setup = (onChange = () => {}) => {
  const props = { onChange, current: mockDS.name };
  window.HTMLElement.prototype.scrollIntoView = function () {};
  return render(<DataSourceDropdown {...props}></DataSourceDropdown>);
};

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getTemplateSrv: () => {
      return {
        getVariables: () => [],
      };
    },
  };
});

jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => {
  return {
    getDataSourceSrv: () => ({
      getList: () => mockDSList,
      getInstanceSettings: () => mockDS,
    }),
  };
});

describe('DataSourceDropdown', () => {
  it('should render', () => {
    expect(() => setup()).not.toThrow();
  });

  describe('interactions', () => {
    const user = userEvent.setup();

    it('should open when clicked', async () => {
      const dropdown = setup();
      const searchBox = dropdown.container.querySelector('input');

      expect(searchBox).toBeInTheDocument();
      if (!searchBox) {
        return;
      }
      await user.click(searchBox);
      expect(await screen.findByText(mockDS.name, { selector: 'span' })).toBeInTheDocument();
    });

    it('should be navigatable by keyboard', async () => {
      const onChange = jest.fn();
      const dropdown = setup(onChange);
      const searchBox = dropdown.container.querySelector('input');

      expect(searchBox).toBeInTheDocument();
      if (!searchBox) {
        return;
      }
      await user.click(searchBox);
      //Dropdown open, first element is selected
      let mockDSElement = getCard(await screen.findByText(mockDS.name, { selector: 'span' }));
      expect(mockDSElement?.getAttribute('data-selectedItem')).toEqual('true');

      await user.keyboard('[ArrowDown]');
      //Arrow down, second item is selected
      const xMockDSElement = getCard(await screen.findByText(xMockDS.name, { selector: 'span' }));
      expect(xMockDSElement?.getAttribute('data-selectedItem')).toEqual('true');
      mockDSElement = getCard(await screen.findByText(mockDS.name, { selector: 'span' }));
      expect(mockDSElement?.getAttribute('data-selectedItem')).toEqual('false');

      await user.keyboard('[ArrowUp]');
      //Arrow up, first item is selected again
      mockDSElement = getCard(await screen.findByText(mockDS.name, { selector: 'span' }));
      expect(mockDSElement?.getAttribute('data-selectedItem')).toEqual('true');

      await user.keyboard('[ArrowDown]');
      await user.keyboard('[Enter]');
      //Arrow down to navigate to xMock, enter to select it. Assert onChange called with correct DS and dropdown closed.
      expect(onChange.mock.lastCall[0]['name']).toEqual(xMockDS.name);
      expect(screen.queryByText(mockDS.name, { selector: 'span' })).toBeNull();
    });

    it('should be searchable', async () => {
      const dropdown = setup();
      const searchBox = dropdown.container.querySelector('input');
      expect(searchBox).toBeInTheDocument();
      if (!searchBox) {
        return;
      }

      await user.click(searchBox);

      await user.keyboard(xMockDS.name); //Search for xMockDS

      expect(screen.queryByText(mockDS.name, { selector: 'span' })).toBeNull();
      expect(await screen.findByText(xMockDS.name, { selector: 'span' })).toBeInTheDocument();

      await user.keyboard('foobarbaz'); //Search for a DS that should not exist

      expect(await screen.findByText('Configure a new data source')).toBeInTheDocument();
    });
  });
});

function getCard(element: HTMLElement) {
  return element.parentElement?.parentElement?.parentElement?.parentElement;
}
