import React from 'react';
import { render, screen } from '@testing-library/react';
import { SignIn } from './SignIn';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';

describe('Render', () => {
  it('should render component', async () => {
    render(
      <Router history={locationService.getHistory()}>
        <SignIn url="/whatever" />
      </Router>
    );

    const link = await screen.getByText('Sign In');
    expect(link).toBeInTheDocument();
  });
});
