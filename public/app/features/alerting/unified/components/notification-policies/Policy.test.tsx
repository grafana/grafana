import { screen, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { noop } from 'lodash';
import React from 'react';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import {
  AlertmanagerGroup,
  MatcherOperator,
  ObjectMatcher,
  RouteWithID,
} from 'app/plugins/datasource/alertmanager/types';
import { ReceiversState } from 'app/types/alerting';

import { mockAlertGroup, mockAlertmanagerAlert, mockReceiversState } from '../../mocks';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { Policy } from './Policy';

beforeAll(() => {
  userEvent.setup();
});

describe('Policy', () => {
  beforeAll(() => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  });

  it('should render a policy tree', async () => {
    const onEditPolicy = jest.fn();
    const onAddPolicy = jest.fn();
    const onDeletePolicy = jest.fn();
    const onShowAlertInstances = jest.fn(
      (alertGroups: AlertmanagerGroup[], matchers?: ObjectMatcher[] | undefined) => {}
    );

    const routeTree = mockRoutes;

    renderPolicy(
      <Policy
        routeTree={routeTree}
        currentRoute={routeTree}
        alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
        onEditPolicy={onEditPolicy}
        onAddPolicy={onAddPolicy}
        onDeletePolicy={onDeletePolicy}
        onShowAlertInstances={onShowAlertInstances}
      />
    );

    // should have default policy
    const defaultPolicy = screen.getByTestId('am-root-route-container');
    expect(defaultPolicy).toBeInTheDocument();
    expect(within(defaultPolicy).getByText('Default policy')).toBeVisible();

    // click "more actions" and check if we can edit and delete
    expect(await within(defaultPolicy).getByTestId('more-actions')).toBeInTheDocument();
    await userEvent.click(within(defaultPolicy).getByTestId('more-actions'));

    // should be editable
    const editDefaultPolicy = screen.getByRole('menuitem', { name: 'Edit' });
    expect(editDefaultPolicy).toBeInTheDocument();
    expect(editDefaultPolicy).not.toBeDisabled();
    await userEvent.click(editDefaultPolicy);
    expect(onEditPolicy).toHaveBeenCalledWith(routeTree, true);

    // should not be deletable
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();

    // default policy should show the metadata

    // no continue matching
    expect(within(defaultPolicy).queryByTestId('continue-matching')).not.toBeInTheDocument();

    // for matching instances
    // expect(within(defaultPolicy).getByTestId('matching-instances')).toHaveTextContent('0instances');

    // for contact point
    expect(within(defaultPolicy).getByTestId('contact-point')).toHaveTextContent('grafana-default-email');
    expect(within(defaultPolicy).getByRole('link', { name: 'grafana-default-email' })).toBeInTheDocument();

    // for grouping
    expect(within(defaultPolicy).getByTestId('grouping')).toHaveTextContent('grafana_folder, alertname');

    // no mute timings
    expect(within(defaultPolicy).queryByTestId('mute-timings')).not.toBeInTheDocument();

    // for timing options
    expect(within(defaultPolicy).getByTestId('timing-options')).toHaveTextContent(
      'Wait30s to group instances,5m before sending updates'
    );

    // should have custom policies
    const customPolicies = screen.getAllByTestId('am-route-container');
    expect(customPolicies).toHaveLength(3);

    // all policies should be editable and deletable
    for (const container of customPolicies) {
      const policy = within(container);

      // click "more actions" and check if we can delete
      await userEvent.click(policy.getByTestId('more-actions'));
      expect(await screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeDisabled();
      expect(await screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeDisabled();

      await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
      expect(onDeletePolicy).toHaveBeenCalled();
    }

    // first custom policy should have the correct information
    const firstPolicy = customPolicies[0];
    expect(within(firstPolicy).getByTestId('label-matchers')).toHaveTextContent(/^team \= operations$/);
    expect(within(firstPolicy).getByTestId('continue-matching')).toBeInTheDocument();
    // expect(within(firstPolicy).getByTestId('matching-instances')).toHaveTextContent('0instances');
    expect(within(firstPolicy).getByTestId('contact-point')).toHaveTextContent('provisioned-contact-point');
    expect(within(firstPolicy).getByTestId('mute-timings')).toHaveTextContent('Muted whenmt-1');
    expect(within(firstPolicy).getByTestId('inherited-properties')).toHaveTextContent('Inherited2 properties');

    // second custom policy should be correct
    const secondPolicy = customPolicies[1];
    expect(within(secondPolicy).getByTestId('label-matchers')).toHaveTextContent(/^region \= EMEA$/);
    expect(within(secondPolicy).queryByTestId('continue-matching')).not.toBeInTheDocument();
    expect(within(secondPolicy).queryByTestId('mute-timings')).not.toBeInTheDocument();
    expect(within(secondPolicy).getByTestId('inherited-properties')).toHaveTextContent('Inherited4 properties');

    // third custom policy should be correct
    const thirdPolicy = customPolicies[2];
    expect(within(thirdPolicy).getByTestId('label-matchers')).toHaveTextContent(
      /^foo = barbar = bazbaz = quxasdf = asdftype = diskand 1 more$/
    );
  });

  it('should not allow editing readOnly policy tree', () => {
    const routeTree: RouteWithID = { id: '0', routes: [{ id: '1' }] };

    renderPolicy(
      <Policy
        readOnly
        routeTree={routeTree}
        currentRoute={routeTree}
        alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
        onEditPolicy={noop}
        onAddPolicy={noop}
        onDeletePolicy={noop}
        onShowAlertInstances={noop}
      />
    );

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it.skip('should show matching instances', () => {
    const routeTree: RouteWithID = {
      id: '0',
      routes: [{ id: '1', object_matchers: [['foo', eq, 'bar']] }],
    };

    const matchingGroups: AlertmanagerGroup[] = [
      mockAlertGroup({
        labels: {},
        alerts: [mockAlertmanagerAlert({ labels: { foo: 'bar' } }), mockAlertmanagerAlert({ labels: { foo: 'bar' } })],
      }),
      mockAlertGroup({
        labels: {},
        alerts: [mockAlertmanagerAlert({ labels: { bar: 'baz' } })],
      }),
    ];

    renderPolicy(
      <Policy
        readOnly
        alertGroups={matchingGroups}
        routeTree={routeTree}
        currentRoute={routeTree}
        alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
        onEditPolicy={noop}
        onAddPolicy={noop}
        onDeletePolicy={noop}
        onShowAlertInstances={noop}
      />
    );

    const defaultPolicy = screen.getByTestId('am-root-route-container');
    expect(within(defaultPolicy).getByTestId('matching-instances')).toHaveTextContent('1instance');
    const customPolicy = screen.getByTestId('am-route-container');
    expect(within(customPolicy).getByTestId('matching-instances')).toHaveTextContent('2instances');
  });

  it('should show warnings and errors', () => {
    const routeTree: RouteWithID = {
      id: '0', // this one should show an error
      receiver: 'broken-receiver',
      routes: [{ id: '1', object_matchers: [] }], // this one should show a warning
    };

    const receiversState: ReceiversState = mockReceiversState();

    renderPolicy(
      <Policy
        readOnly
        routeTree={routeTree}
        currentRoute={routeTree}
        contactPointsState={receiversState}
        alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
        onEditPolicy={noop}
        onAddPolicy={noop}
        onDeletePolicy={noop}
        onShowAlertInstances={noop}
      />
    );

    const defaultPolicy = screen.getByTestId('am-root-route-container');
    expect(within(defaultPolicy).queryByTestId('matches-all')).not.toBeInTheDocument();
    expect(within(defaultPolicy).getByText('1 error')).toBeInTheDocument();

    const customPolicy = screen.getByTestId('am-route-container');
    expect(within(customPolicy).getByTestId('matches-all')).toBeInTheDocument();
  });
});

const renderPolicy = (element: JSX.Element) =>
  render(<Router history={locationService.getHistory()}>{element}</Router>);

const eq = MatcherOperator.equal;

const mockRoutes: RouteWithID = {
  id: '0',
  receiver: 'grafana-default-email',
  group_by: ['grafana_folder', 'alertname'],
  routes: [
    {
      id: '1',
      receiver: 'provisioned-contact-point',
      object_matchers: [['team', eq, 'operations']],
      mute_time_intervals: ['mt-1'],
      continue: true,
      routes: [
        {
          id: '2',
          object_matchers: [['region', eq, 'EMEA']],
        },
        {
          id: '3',
          receiver: 'grafana-default-email',
          object_matchers: [
            ['foo', eq, 'bar'],
            ['bar', eq, 'baz'],
            ['baz', eq, 'qux'],
            ['asdf', eq, 'asdf'],
            ['type', eq, 'disk'],
            ['severity', eq, 'critical'],
          ],
        },
      ],
    },
  ],
  group_wait: '30s',
};
