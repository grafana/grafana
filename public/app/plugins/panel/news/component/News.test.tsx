import { OpenFeatureTestProvider } from '@openfeature/react-sdk';
import { render, screen } from '@testing-library/react';

import { arrayToDataFrame, DataFrameView } from '@grafana/data';

import { type NewsItem } from '../types';

import { News } from './News';

const newsItem: NewsItem = {
  date: Date.UTC(2026, 0, 1),
  title: 'Grafana news title',
  link: 'https://grafana.com/blog/news',
  content: '<p>News content</p>',
};

function renderNews(headingLevel?: 1 | 2 | 3 | 4 | 5 | 6) {
  const data = new DataFrameView<NewsItem>(arrayToDataFrame([newsItem]));

  return render(
    <OpenFeatureTestProvider>
      <News data={data} index={0} {...(headingLevel ? { headingLevel } : {})} />
    </OpenFeatureTestProvider>
  );
}

describe('News', () => {
  it('renders its default title as a non-heading link', () => {
    renderNews();

    expect(screen.getByRole('link', { name: 'Grafana news title' })).toHaveAttribute(
      'href',
      'https://grafana.com/blog/news'
    );
    expect(screen.queryByRole('heading', { name: 'Grafana news title' })).not.toBeInTheDocument();
  });

  it('renders its title as an H3 when headingLevel is 3', () => {
    renderNews(3);

    const titleHeading = screen.getByRole('heading', { level: 3, name: 'Grafana news title' });
    expect(titleHeading).toContainElement(screen.getByRole('link', { name: 'Grafana news title' }));
  });

  it('labels the article with its title', () => {
    renderNews();

    expect(screen.getByRole('article')).toHaveAccessibleName('Grafana news title');
  });
});
