import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { NavModelItem } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import { QuickAdd } from './QuickAdd';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
  };
});

const setup = () => {
  const navBarTree: NavModelItem[] = [
    {
      text: 'Section 1',
      id: 'section1',
      url: 'section1',
      children: [
        { text: 'New child 1', id: 'child1', url: '#', isCreateAction: true },
        { text: 'Child2', id: 'child2', url: 'section1/child2' },
      ],
    },
    {
      text: 'Section 2',
      id: 'section2',
      url: 'section2',
      children: [{ text: 'New child 3', id: 'child3', url: 'section2/child3', isCreateAction: true }],
    },
  ];

  return render(
    <TestProvider storeState={{ navBarTree }}>
      <QuickAdd />
    </TestProvider>
  );
};

describe('QuickAdd', () => {
  beforeAll(() => {
    jest.spyOn(window, 'matchMedia').mockImplementation(
      () =>
        ({
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          matches: true,
        }) as unknown as MediaQueryList
    );
  });

  it('renders a `New` button', () => {
    setup();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
  });

  it('shows isCreateAction options when clicked', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(screen.getByRole('link', { name: 'New child 1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New child 3' })).toBeInTheDocument();
  });

  it('reports interaction when a menu item is clicked', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    await userEvent.click(screen.getByRole('link', { name: 'New child 1' }));

    expect(reportInteraction).toHaveBeenCalledWith('grafana_menu_item_clicked', {
      url: '#',
      from: 'quickadd',
    });
  });
});
