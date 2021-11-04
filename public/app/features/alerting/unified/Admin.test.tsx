import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { locationService } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import Admin from './Admin';

const renderAdminPage = () => {
  return render(
    <Provider store={configureStore()}>
      <Router history={locationService.getHistory()}>
        <Admin />
      </Router>
    </Provider>
  );
};

describe('Admin page', () => {
  it('render the admin page', () => {
    renderAdminPage();
    expect(screen.getByText('Configuration')).toBeInTheDocument();
    expect(screen.getByText('External Alertmanagers')).toBeInTheDocument();
  });
});
