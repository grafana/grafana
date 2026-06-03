import { render, screen } from 'test/test-utils';

import { DashboardPreviewCards } from './DashboardPreviewCards';
import { dashboardPreviewCards } from './dashboardPreviewData';

describe('DashboardPreviewCards', () => {
  it('renders the section heading', () => {
    render(<DashboardPreviewCards />);
    expect(screen.getByText('Explore Dashboards')).toBeInTheDocument();
  });

  it('renders all preview cards', () => {
    render(<DashboardPreviewCards />);
    for (const card of dashboardPreviewCards) {
      expect(screen.getByText(card.title)).toBeInTheDocument();
      expect(screen.getByText(card.description)).toBeInTheDocument();
    }
  });

  it('renders cards as links to the correct folders', () => {
    render(<DashboardPreviewCards />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(dashboardPreviewCards.length);
    for (let i = 0; i < dashboardPreviewCards.length; i++) {
      expect(links[i]).toHaveAttribute('href', dashboardPreviewCards[i].href);
    }
  });

  it('renders preview images with correct alt text', () => {
    render(<DashboardPreviewCards />);
    for (const card of dashboardPreviewCards) {
      const img = screen.getByAltText(card.title);
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', card.imagePath);
    }
  });
});
