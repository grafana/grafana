import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import React, { PropsWithChildren } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { AccessControlAction } from 'app/types';

import { grantUserPermissions, mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
import { DataSourceType } from '../../utils/datasource';

import ContactPoints from './ContactPoints.v2';
import setupMimirFlavoredServer, { MIMIR_DATASOURCE_UID } from './__mocks__/mimirFlavoredServer';

/**
 * There are lots of ways in which we test our pages and components. Here's my opinionated approach to testing them.
 *
 *  Use MSW to mock API responses, you can copy the JSON results from the network panel and use them in a __mocks__ folder.
 *
 * 1. Make sure we have "presentation" components we can test without mocking data,
 *    test these if they have some logic in them (hiding / showing things) and sad paths.
 *
 * 2. For testing the "container" components, check if data fetching is working as intended (you can use loading state)
 *    and check if we're not in an error state (although you can test for that too for sad path).
 *
 * 3. Write tests for the hooks we call in the "container" components
 *    if those have any logic or data structure transformations in them.
 */

describe('Contact points with Mimir-flavored alertmanager', () => {
  setupMimirFlavoredServer();

  beforeAll(() => {
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsExternalRead,
      AccessControlAction.AlertingNotificationsExternalWrite,
    ]);
    setupDataSources(
      mockDataSource({
        type: DataSourceType.Alertmanager,
        name: MIMIR_DATASOURCE_UID,
        uid: MIMIR_DATASOURCE_UID,
      })
    );
  });

  it('should show / hide loading states', async () => {
    render(
      <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={MIMIR_DATASOURCE_UID}>
        <ContactPoints />
      </AlertmanagerProvider>,
      { wrapper: TestProvider }
    );

    await waitFor(async () => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      await waitForElementToBeRemoved(screen.getByText('Loading...'));
      expect(screen.queryByTestId(selectors.components.Alert.alertV2('error'))).not.toBeInTheDocument();
    });

    expect(screen.getByText('mixed')).toBeInTheDocument();
    expect(screen.getByText('some webhook')).toBeInTheDocument();
    expect(screen.getAllByTestId('contact-point')).toHaveLength(2);
  });
});
