import { render, screen } from '@testing-library/react';

import { SplashScreenSlide } from './SplashScreenSlide';
import { type SplashFeature } from './splashContent';

const mockFeature: SplashFeature = {
  id: 'test-feature',
  icon: 'apps',
  badgeText: 'NEW',
  accentColor: 'primary',
  title: 'Test Feature Title',
  subtitle: 'Test subtitle text',
  bullets: ['Bullet one', 'Bullet two', 'Bullet three'],
  heroImageUrl: 'https://placehold.co/400x400',
};

describe('SplashScreenSlide', () => {
  it('renders feature title, subtitle, and bullets from props', () => {
    render(<SplashScreenSlide feature={mockFeature} />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Test Feature Title');
    expect(screen.getByText('Test subtitle text')).toBeInTheDocument();
    expect(screen.getByText('Bullet one')).toBeInTheDocument();
    expect(screen.getByText('Bullet two')).toBeInTheDocument();
    expect(screen.getByText('Bullet three')).toBeInTheDocument();
  });

  it('handles empty bullets array without crashing', () => {
    const featureNoBullets = { ...mockFeature, bullets: [] };
    render(<SplashScreenSlide feature={featureNoBullets} />);

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('renders footer slot when provided', () => {
    render(<SplashScreenSlide feature={mockFeature} footer={<button>CTA</button>} />);

    expect(screen.getByRole('button', { name: 'CTA' })).toBeInTheDocument();
  });
});
