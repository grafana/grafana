import { render, screen } from '@testing-library/react';
import React from 'react';
import { Router } from 'react-router-dom';

import { GrafanaConfig, locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { TextLink } from './TextLink';

describe('TextLink', () => {
  let windowSpy: jest.SpyInstance;

  beforeAll(() => {
    windowSpy = jest.spyOn(window, 'location', 'get');
    windowSpy.mockImplementation(() => ({
      origin: 'http://www.grafana.com',
    }));
  });

  afterAll(() => {
    windowSpy.mockRestore();
  });

  const link = 'http://www.grafana.com/grafana/after-sub-url';
  it('should keep the whole url, including app sub url, if external', () => {
    locationUtil.initialize({
      config: { appSubUrl: '/grafana' } as GrafanaConfig,
      getVariablesUrlParams: jest.fn(),
      getTimeRangeForUrl: jest.fn(),
    });

    render(
      <TextLink href={link} external>
        Link to Grafana
      </TextLink>
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', link);
  });
  it('should turn it into a relative url, if not external', () => {
    locationUtil.initialize({
      config: { appSubUrl: '/grafana' } as GrafanaConfig,
      getVariablesUrlParams: jest.fn(),
      getTimeRangeForUrl: jest.fn(),
    });

    render(
      <Router history={locationService.getHistory()}>
        <TextLink href={link}>Link to Grafana</TextLink>
      </Router>
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/after-sub-url');
  });
});
