import { render } from '@testing-library/react';
import React from 'react';

import { AlertmanagerChoice } from '../../../../plugins/datasource/alertmanager/types';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { GrafanaAlertmanagerDeliveryWarning } from './GrafanaAlertmanagerDeliveryWarning';

describe('GrafanaAlertmanagerDeliveryWarning', () => {
  describe('When AlertmanagerChoice set to External', () => {
    it('Should not render when the datasource is not Grafana', () => {
      const { container } = render(
        <GrafanaAlertmanagerDeliveryWarning
          currentAlertmanager="custom-alertmanager"
          alertmanagerChoice={AlertmanagerChoice.External}
        />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('Should render warning when the datasource is Grafana', () => {
      const { container } = render(
        <GrafanaAlertmanagerDeliveryWarning
          currentAlertmanager={GRAFANA_RULES_SOURCE_NAME}
          alertmanagerChoice={AlertmanagerChoice.External}
        />
      );

      expect(container).toHaveTextContent('Grafana alerts are not delivered to Grafana Alertmanager');
    });
  });

  it.each([AlertmanagerChoice.All, AlertmanagerChoice.Internal])(
    'Should not render when datasource is Grafana and Alertmanager choice is %s',
    (choice) => {
      const { container } = render(
        <GrafanaAlertmanagerDeliveryWarning
          currentAlertmanager={GRAFANA_RULES_SOURCE_NAME}
          alertmanagerChoice={choice}
        />
      );

      expect(container).toBeEmptyDOMElement();
    }
  );
});
