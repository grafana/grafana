import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { getWrapper } from 'test/test-utils';

import { disablePlugin } from 'app/features/alerting/unified/mocks/server/configure';
import { setOnCallIntegrations } from 'app/features/alerting/unified/mocks/server/handlers/plugins/configure-plugins';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';
import { setAlertmanagerConfig } from '../../mocks/server/entities/alertmanagers';
import { Provenance } from '../../types/provenance';

import { useContactPointsWithStatus } from './useContactPoints';

const wrapper = ({ children }: { children: ReactNode }) => {
  const ProviderWrapper = getWrapper({ renderWithRouter: true });
  return <ProviderWrapper>{children}</ProviderWrapper>;
};

setupMswServer();

const getHookResponse = async () => {
  const { result } = renderHook(
    () =>
      useContactPointsWithStatus({
        alertmanager: GRAFANA_RULES_SOURCE_NAME,
        fetchPolicies: true,
        fetchStatuses: true,
      }),
    {
      wrapper,
    }
  );

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  // Only return some properties, as we don't want to compare all
  // RTK query properties in snapshots/comparison between k8s and non-k8s implementations
  // (would include properties like requestId, fulfilled, etc.)
  const { contactPoints, error, isLoading } = result.current;

  return { contactPoints, error, isLoading };
};

describe('useContactPoints', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingNotificationsRead]);
    setOnCallIntegrations([
      {
        display_name: 'grafana-integration',
        value: 'ABC123',
        integration_url: 'https://oncall-endpoint.example.com',
      },
    ]);
  });

  it('should return contact points with status', async () => {
    disablePlugin(SupportedPlugin.OnCall);
    const snapshot = await getHookResponse();
    expect(snapshot).toMatchSnapshot();
  });

  describe('when having oncall plugin installed and no alert manager config data', () => {
    it('should return contact points with oncall metadata', async () => {
      const snapshot = await getHookResponse();
      expect(snapshot).toMatchSnapshot();
    });
  });

  describe('Provenance handling', () => {
    describe('K8s API receivers (Grafana AM)', () => {
      it('should extract provenance when provenance is "api"', async () => {
        // Set up alertmanager config with a receiver that has API provenance
        const config: AlertManagerCortexConfig = {
          template_files: {},
          alertmanager_config: {
            receivers: [
              {
                name: 'api-provenance-contact-point',
                grafana_managed_receiver_configs: [
                  {
                    uid: 'test-uid-1',
                    name: 'api-provenance-contact-point',
                    type: 'email',
                    disableResolveMessage: false,
                    settings: {
                      addresses: 'test@example.com',
                    },
                    secureFields: {},
                    provenance: 'api', // This will be used by the K8s mock handler
                  },
                ],
              },
            ],
          },
        };
        setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, config);

        const { result } = renderHook(
          () =>
            useContactPointsWithStatus({
              alertmanager: GRAFANA_RULES_SOURCE_NAME,
              fetchPolicies: false,
              fetchStatuses: false,
            }),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        const contactPoint = result.current.contactPoints?.find((cp) => cp.name === 'api-provenance-contact-point');
        expect(contactPoint).toBeDefined();
        expect(contactPoint?.provenance).toBe(Provenance.API);
      });

      it('should extract provenance when provenance is "file"', async () => {
        const config: AlertManagerCortexConfig = {
          template_files: {},
          alertmanager_config: {
            receivers: [
              {
                name: 'file-provenance-contact-point',
                grafana_managed_receiver_configs: [
                  {
                    uid: 'test-uid-2',
                    name: 'file-provenance-contact-point',
                    type: 'email',
                    disableResolveMessage: false,
                    settings: {
                      addresses: 'test@example.com',
                    },
                    secureFields: {},
                    provenance: 'file',
                  },
                ],
              },
            ],
          },
        };
        setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, config);

        const { result } = renderHook(
          () =>
            useContactPointsWithStatus({
              alertmanager: GRAFANA_RULES_SOURCE_NAME,
              fetchPolicies: false,
              fetchStatuses: false,
            }),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        const contactPoint = result.current.contactPoints?.find((cp) => cp.name === 'file-provenance-contact-point');
        expect(contactPoint).toBeDefined();
        expect(contactPoint?.provenance).toBe(Provenance.File);
      });

      it('should extract provenance when provenance is "converted_prometheus"', async () => {
        const config: AlertManagerCortexConfig = {
          template_files: {},
          alertmanager_config: {
            receivers: [
              {
                name: 'mimir-provenance-contact-point',
                grafana_managed_receiver_configs: [
                  {
                    uid: 'test-uid-3',
                    name: 'mimir-provenance-contact-point',
                    type: 'email',
                    disableResolveMessage: false,
                    settings: {
                      addresses: 'test@example.com',
                    },
                    secureFields: {},
                    provenance: 'converted_prometheus',
                  },
                ],
              },
            ],
          },
        };
        setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, config);

        const { result } = renderHook(
          () =>
            useContactPointsWithStatus({
              alertmanager: GRAFANA_RULES_SOURCE_NAME,
              fetchPolicies: false,
              fetchStatuses: false,
            }),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        const contactPoint = result.current.contactPoints?.find((cp) => cp.name === 'mimir-provenance-contact-point');
        expect(contactPoint).toBeDefined();
        expect(contactPoint?.provenance).toBe(Provenance.ConvertedPrometheus);
      });

      it('should map "none" provenance annotation to Provenance.None', async () => {
        const config: AlertManagerCortexConfig = {
          template_files: {},
          alertmanager_config: {
            receivers: [
              {
                name: 'none-provenance-contact-point',
                grafana_managed_receiver_configs: [
                  {
                    uid: 'test-uid-4',
                    name: 'none-provenance-contact-point',
                    type: 'email',
                    disableResolveMessage: false,
                    settings: {
                      addresses: 'test@example.com',
                    },
                    secureFields: {},
                    // No provenance field - will default to PROVENANCE_NONE in mock handler
                  },
                ],
              },
            ],
          },
        };
        setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, config);

        const { result } = renderHook(
          () =>
            useContactPointsWithStatus({
              alertmanager: GRAFANA_RULES_SOURCE_NAME,
              fetchPolicies: false,
              fetchStatuses: false,
            }),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        const contactPoint = result.current.contactPoints?.find((cp) => cp.name === 'none-provenance-contact-point');
        expect(contactPoint).toBeDefined();
        // The mock handler sets PROVENANCE_NONE ('none') when no provenance is found
        // parseK8sReceiver converts 'none' to Provenance.None
        expect(contactPoint?.provenance).toBe(Provenance.None);
      });

      it('should handle missing annotations gracefully', async () => {
        // This test verifies that when annotations are undefined, provenance is handled correctly
        const config: AlertManagerCortexConfig = {
          template_files: {},
          alertmanager_config: {
            receivers: [
              {
                name: 'no-annotations-contact-point',
                grafana_managed_receiver_configs: [
                  {
                    uid: 'test-uid-5',
                    name: 'no-annotations-contact-point',
                    type: 'email',
                    disableResolveMessage: false,
                    settings: {
                      addresses: 'test@example.com',
                    },
                    secureFields: {},
                  },
                ],
              },
            ],
          },
        };
        setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, config);

        const { result } = renderHook(
          () =>
            useContactPointsWithStatus({
              alertmanager: GRAFANA_RULES_SOURCE_NAME,
              fetchPolicies: false,
              fetchStatuses: false,
            }),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        const contactPoint = result.current.contactPoints?.find((cp) => cp.name === 'no-annotations-contact-point');
        expect(contactPoint).toBeDefined();
        // When annotations are missing, the mock handler should still provide a default
        expect(contactPoint?.provenance).toBeDefined();
      });
    });

    describe('non-K8s API provenance flow', () => {
      it('should extract provenance from Alertmanager config receiver configs for Grafana AM', async () => {
        // Set up Alertmanager config with receiver that has provenance on receiver config
        const config: AlertManagerCortexConfig = {
          template_files: {},
          alertmanager_config: {
            receivers: [
              {
                name: 'non-k8s-provenance-contact-point',
                grafana_managed_receiver_configs: [
                  {
                    uid: 'test-uid',
                    name: 'non-k8s-provenance-contact-point',
                    type: 'email',
                    disableResolveMessage: false,
                    settings: {
                      addresses: 'test@example.com',
                    },
                    secureFields: {},
                    provenance: Provenance.File, // Provenance on receiver config
                  },
                ],
              },
            ],
          },
        };
        setAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME, config);

        const { result } = renderHook(
          () =>
            useContactPointsWithStatus({
              alertmanager: GRAFANA_RULES_SOURCE_NAME,
              fetchPolicies: false,
              fetchStatuses: false,
            }),
          { wrapper }
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        const contactPoint = result.current.contactPoints?.find((cp) => cp.name === 'non-k8s-provenance-contact-point');
        expect(contactPoint).toBeDefined();
        // Provenance should be extracted from receiver config and set on contact point
        expect(contactPoint?.provenance).toBe(Provenance.File);
      });
    });
  });
});
