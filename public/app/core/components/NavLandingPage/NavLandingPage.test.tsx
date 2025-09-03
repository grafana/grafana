import { render, screen } from '@testing-library/react';
import { useLocation } from 'react-use';
import { TestProvider } from 'test/helpers/TestProvider';

import { config, setPluginComponentHook } from '@grafana/runtime';

import { NavLandingPage } from './NavLandingPage';

jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useLocation: jest.fn().mockReturnValue({ pathname: '/', trigger: '', search: '' }),
}));

describe('NavLandingPage', () => {
  beforeEach(() => {
    // Mock the plugin component hook to prevent the error
    setPluginComponentHook(() => ({
      component: () => <div>ObservabilityLandingPage</div>,
      isLoading: false,
    }));
  });

  const mockSectionTitle = 'Section title';
  const mockId = 'section';
  const mockSectionUrl = 'mock-section-url';
  const mockSectionSubtitle = 'Section subtitle';
  const mockChild1 = {
    text: 'Child 1',
    subTitle: 'Child 1 subTitle',
    id: 'child1',
    url: 'mock-section-url/child1',
  };
  const mockChild2 = {
    text: 'Child 2',
    subTitle: 'Child 2 subTitle',
    id: 'child2',
    url: 'mock-section-url/child2',
  };
  const mockChild3 = {
    text: 'Child 3',
    id: 'child3',
    subTitle: 'Child 3 subtitle',
    url: 'mock-section-url/child3',
    hideFromTabs: true,
    children: [
      {
        text: 'Child 3.1',
        subTitle: 'Child 3.1 subTitle',
        id: 'child3.1',
        url: 'mock-section-url/child3/child3.1',
      },
    ],
  };

  const setup = (showHeader = false) => {
    config.bootData.navTree = [
      {
        text: mockSectionTitle,
        id: mockId,
        url: mockSectionUrl,
        subTitle: mockSectionSubtitle,
        children: [mockChild1, mockChild2, mockChild3],
      },
    ];

    const header = showHeader ? <h3>Custom Header</h3> : undefined;
    return render(
      <TestProvider>
        <NavLandingPage navId={mockId} header={header} />
      </TestProvider>
    );
  };

  it('uses the section text as a heading', () => {
    setup();
    expect(screen.getByRole('heading', { name: mockSectionTitle })).toBeInTheDocument();
  });

  it('renders the section subtitle', () => {
    setup();
    expect(screen.getByText(mockSectionSubtitle)).toBeInTheDocument();
  });

  it('renders a link for each direct child', () => {
    setup();
    expect(screen.getByRole('link', { name: mockChild1.text })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: mockChild2.text })).toBeInTheDocument();
  });

  it('renders the subTitle for each direct child', () => {
    setup();
    expect(screen.getByText(mockChild1.subTitle)).toBeInTheDocument();
    expect(screen.getByText(mockChild2.subTitle)).toBeInTheDocument();
  });

  it('renders the custom header when supplied', () => {
    setup(true);
    expect(screen.getByRole('heading', { name: 'Custom Header' })).toBeInTheDocument();
  });

  it('renders the ObservabilityLandingPage when the path is /observability', () => {
    jest.mocked(useLocation).mockReturnValue({ pathname: '/observability', trigger: '', search: '' });
    setup();
    expect(screen.getByText('ObservabilityLandingPage')).toBeInTheDocument();
  });
});
