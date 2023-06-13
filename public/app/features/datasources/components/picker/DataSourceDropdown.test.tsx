import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { DataSourceDropdown } from './DataSourceDropdown';

const mockDS = {
  name: 'mockDS',
  uid: 'mockDSuid',
  meta: { name: 'mockDS', info: { logos: { small: 'mockLogoPath' } } },
};

const setup = () => {
  const props = { onChange: () => {}, current: mockDS.name };
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

jest.mock('../../hooks', () => {
  const hooks = jest.requireActual('../../hooks');
  return {
    ...hooks,
    useDatasource: () => {
      return mockDS;
    },
    useDatasources: () => {
      return [mockDS];
    },
  };
});

describe('DataSourceDropdown', () => {
  it('should render', () => {
    expect(() => setup()).not.toThrow();
  });

  it('it should open when clicked', async () => {
    const dropdown = setup();
    const clickableElement = dropdown.container.querySelector('input');

    expect(clickableElement).toBeInTheDocument();
    if (clickableElement) {
      fireEvent.click(clickableElement);
      expect(await screen.findByText('mockDS', { selector: 'span' })).toBeInTheDocument();
    }
  });
});
