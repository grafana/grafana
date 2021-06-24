import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
import { RuleViewer } from './RuleViewer';
import { configureStore } from 'app/store/configureStore';
import { GrafanaRouteComponentProps } from '../../../core/navigation/types';

const mockRoute: GrafanaRouteComponentProps<{ id?: string; sourceName?: string }> = {
  route: {
    path: '/',
    component: RuleViewer,
  },
  queryParams: { returnTo: '/alerting/list' },
  match: { params: { id: 'test1', sourceName: 'grafana' }, isExact: false, url: 'asdf', path: '' },
  history: locationService.getHistory(),
  location: { pathname: '', hash: '', search: '', state: '' },
  staticContext: {},
};

const store = configureStore();
const renderRuleViewer = () => {
  return render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <RuleViewer {...mockRoute} />
      </Router>
    </Provider>
  );
};
describe('RuleViewer', () => {
  it('should render page', () => {
    renderRuleViewer();
    expect(screen.getByText('Alerting / View rule')).toBeInTheDocument();
  });
});
