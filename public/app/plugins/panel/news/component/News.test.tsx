import { render, screen } from 'test/test-utils';

import { arrayToDataFrame, DataFrameView } from '@grafana/data';

import { type NewsItem } from '../types';

import { News } from './News';

const newsItem: NewsItem = {
  date: Date.UTC(2026, 0, 1),
  title: 'Grafana news title',
  link: 'https://grafana.com/blog/news',
  content: '<p>News content</p>',
};

describe('News', () => {
  it('renders its default title as a non-heading link', () => {
    const data = new DataFrameView<NewsItem>(arrayToDataFrame([newsItem]));
    render(<News data={data} index={0} />);

    expect(screen.getByRole('link', { name: 'Grafana news title' })).toHaveAttribute(
      'href',
      'https://grafana.com/blog/news'
    );
    expect(screen.queryByRole('heading', { name: 'Grafana news title' })).not.toBeInTheDocument();
  });

  it('renders its title as an H3 when headingLevel is 3', () => {
    const data = new DataFrameView<NewsItem>(arrayToDataFrame([newsItem]));
    render(<News data={data} index={0} headingLevel={3} />);

    const titleHeading = screen.getByRole('heading', { level: 3, name: 'Grafana news title' });
    expect(titleHeading).toContainElement(screen.getByRole('link', { name: 'Grafana news title' }));
  });

  it('labels the article with its title', () => {
    const data = new DataFrameView<NewsItem>(arrayToDataFrame([newsItem]));
    render(<News data={data} index={0} />);

    expect(screen.getByRole('article')).toHaveAccessibleName('Grafana news title');
  });
});
