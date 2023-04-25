import { render } from '@testing-library/react';
import React from 'react';

import { DataSourceDescription } from './DataSourceDescription';

describe('<DataSourceDescription />', () => {
  it('should render data source name', () => {
    const dataSourceName = 'Test data source name';
    const { getByText } = render(<DataSourceDescription dataSourceName={dataSourceName} />);

    expect(getByText(dataSourceName, { exact: false })).toBeInTheDocument();
  });

  it('should not render docs link when `docsLink` prop is not passed', () => {
    const { getByText } = render(<DataSourceDescription dataSourceName={'Test data source name'} />);

    expect(() => getByText('view the documentation')).toThrow();
  });

  it('should render docs link when `docsLink` prop is passed', () => {
    const docsLink = 'https://grafana.com/test-datasource-docs';
    const { getByText } = render(
      <DataSourceDescription dataSourceName={'Test data source name'} docsLink={docsLink} />
    );

    const docsLinkEl = getByText('view the documentation');

    expect(docsLinkEl.getAttribute('href')).toBe(docsLink);
  });

  it('should not render text about required fields when `hasRequiredFields` prop is not passed', () => {
    const { getByText } = render(
      <DataSourceDescription
        dataSourceName={'Test data source name'}
        docsLink={'https://grafana.com/test-datasource-docs'}
      />
    );

    expect(() => getByText('Fields marked in', { exact: false })).toThrow();
  });

  it('should render text about required fields when `hasRequiredFields` prop is `true`', () => {
    const { getByText } = render(
      <DataSourceDescription
        dataSourceName={'Test data source name'}
        docsLink={'https://grafana.com/test-datasource-docs'}
        hasRequiredFields={true}
      />
    );

    expect(getByText('Fields marked in', { exact: false })).toBeInTheDocument();
  });
});
