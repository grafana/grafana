import { css } from '@emotion/css';
import { useState, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { 
  Alert, 
  Button, 
  Card, 
  LoadingPlaceholder, 
  Stack,
  Text, 
  Badge,
  Modal,
  useStyles2,
  HorizontalGroup,
  VerticalGroup,
  Box,
  Select,
  Field,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';

interface BrokenPanel {
  panelID: number;
  panelTitle: string;
  panelType: string;
  errorType: string;
  errorMessage: string;
  datasource?: {
    uid: string;
    type: string;
    name: string;
  };
  position?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

interface BrokenPanelsResult {
  dashboardUID: string;
  dashboardTitle: string;
  brokenPanels: BrokenPanel[];
  totalCount: number;
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    padding: ${theme.spacing(2)};
  `,
  statsCard: css`
    margin-bottom: ${theme.spacing(2)};
  `,
  filterSection: css`
    margin-bottom: ${theme.spacing(2)};
  `,
  tableContainer: css`
    margin-top: ${theme.spacing(2)};
  `,
  modalContent: css`
    max-width: 600px;
  `,
  errorBadge: css`
    margin-bottom: ${theme.spacing(1)};
  `,
  tableWrapper: css`
    overflow-x: auto;
  `,
  table: css`
    width: 100%;
    border-collapse: collapse;
    
    th, td {
      padding: ${theme.spacing(1)};
      text-align: left;
      border-bottom: 1px solid ${theme.colors.border.weak};
    }
    
    th {
      font-weight: ${theme.typography.fontWeightMedium};
      color: ${theme.colors.text.primary};
      background-color: ${theme.colors.background.secondary};
    }
    
    td {
      color: ${theme.colors.text.primary};
    }
  `,
  tableRow: css`
    cursor: pointer;
    &:hover {
      background-color: ${theme.colors.background.secondary};
    }
  `,
});

const errorTypeColors = {
  'datasource_not_found': 'red',
  'datasource_access_denied': 'orange',
  'plugin_not_found': 'purple',
  'plugin_version_mismatch': 'blue',
  'invalid_query': 'orange',
  'missing_targets': 'orange',
  'invalid_configuration': 'red',
} as const;

const errorTypeLabels = {
  'datasource_not_found': 'Datasource Not Found',
  'datasource_access_denied': 'Datasource Access Denied',
  'plugin_not_found': 'Plugin Not Found',
  'plugin_version_mismatch': 'Plugin Version Mismatch',
  'invalid_query': 'Invalid Query',
  'missing_targets': 'Missing Targets',
  'invalid_configuration': 'Invalid Configuration',
};

export default function RepairToolPage() {
  const styles = useStyles2(getStyles);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brokenPanelsData, setBrokenPanelsData] = useState<BrokenPanelsResult | null>(null);
  const [selectedErrorType, setSelectedErrorType] = useState<string>('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState<BrokenPanel | null>(null);

  useEffect(() => {
    loadBrokenPanels();
  }, []);

  const loadBrokenPanels = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // For now, we'll use a mock response since the API isn't fully connected
      // In a real implementation, this would call the brokenpanels API
      const mockData: BrokenPanelsResult = {
        dashboardUID: '',
        dashboardTitle: '',
        brokenPanels: [
          {
            panelID: 1,
            panelTitle: 'Sample Broken Panel',
            panelType: 'graph',
            errorType: 'datasource_not_found',
            errorMessage: 'Datasource "missing-ds" not found',
            datasource: {
              uid: 'missing-ds',
              type: 'prometheus',
              name: 'Missing Datasource'
            },
            position: {
              x: 0,
              y: 0,
              w: 12,
              h: 8
            }
          }
        ],
        totalCount: 1
      };
      
      setBrokenPanelsData(mockData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load broken panels');
    } finally {
      setLoading(false);
    }
  };

  const handlePanelClick = (panel: BrokenPanel) => {
    setSelectedPanel(panel);
    setShowDetailsModal(true);
  };

  const handleInvalidateDashboardCache = async (dashboardUID: string) => {
    try {
      // This would call the cache invalidation API
      console.log('Invalidating cache for dashboard:', dashboardUID);
      // await getBackendSrv().delete(`/api/brokenpanels/cache/dashboard/${dashboardUID}`);
      alert('Cache invalidation would be implemented here');
    } catch (err) {
      console.error('Failed to invalidate cache:', err);
    }
  };

  const handleRefresh = () => {
    loadBrokenPanels();
  };

  const filteredPanels = brokenPanelsData?.brokenPanels.filter(panel => {
    if (selectedErrorType && panel.errorType !== selectedErrorType) {
      return false;
    }
    return true;
  }) || [];

  const uniqueErrorTypes = [...new Set(brokenPanelsData?.brokenPanels.map(p => p.errorType) || [])];

  if (!contextSrv.hasPermission(AccessControlAction.ActionServerStatsRead)) {
    return (
      <Page navId="admin">
        <Alert title="Access Denied" severity="error">
          You don't have permission to access the Repair Tool.
        </Alert>
      </Page>
    );
  }

  if (loading) {
    return (
      <Page navId="admin">
        <LoadingPlaceholder text="Loading broken panels..." />
      </Page>
    );
  }

  if (error) {
    return (
      <Page navId="admin">
        <Alert title="Error" severity="error">
          {error}
        </Alert>
      </Page>
    );
  }

  return (
    <Page navId="admin">
      <Page.Contents>
        <div className={styles.container}>
          <div style={{ marginBottom: '20px' }}>
            <h1>Repair Tool</h1>
            <p>Identify and diagnose broken panels across your dashboards</p>
            <Button onClick={handleRefresh} icon="sync">
              Refresh
            </Button>
          </div>

          {/* Statistics Cards */}
          <Stack direction="row" gap={2}>
            <Card>
              <Card.Heading>
                <Trans i18nKey="admin.repair-tool.total-broken-panels">Total Broken Panels</Trans>
              </Card.Heading>
              <Card.Description>
                <Text variant="h2">{brokenPanelsData?.totalCount || 0}</Text>
              </Card.Description>
            </Card>

            <Card>
              <Card.Heading>
                <Trans i18nKey="admin.repair-tool.unique-error-types">Unique Error Types</Trans>
              </Card.Heading>
              <Card.Description>
                <Text variant="h2">{uniqueErrorTypes.length}</Text>
              </Card.Description>
            </Card>
          </Stack>

          {/* Filters */}
          <div className={styles.filterSection}>
            <Card>
              <Card.Heading>Filters</Card.Heading>
              <Card.Description>
                <HorizontalGroup>
                  <Field label="Error Type">
                    <Select
                      placeholder="All error types"
                      value={selectedErrorType}
                      onChange={(value) => setSelectedErrorType(value.value || '')}
                      options={[
                        { label: 'All error types', value: '' },
                        ...uniqueErrorTypes.map(type => ({ 
                          label: errorTypeLabels[type as keyof typeof errorTypeLabels] || type, 
                          value: type 
                        }))
                      ]}
                    />
                  </Field>
                </HorizontalGroup>
              </Card.Description>
            </Card>
          </div>

          {/* Broken Panels Table */}
          <div className={styles.tableContainer}>
            <Card>
              <Card.Heading>
                <Trans i18nKey="admin.repair-tool.broken-panels">Broken Panels</Trans>
              </Card.Heading>
              {filteredPanels.length > 0 ? (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Panel ID</th>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Error Type</th>
                        <th>Error Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPanels.map((panel) => (
                        <tr key={panel.panelID} onClick={() => handlePanelClick(panel)} className={styles.tableRow}>
                          <td>
                            <Button 
                              variant="secondary" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePanelClick(panel);
                              }}
                              style={{ padding: 0, height: 'auto' }}
                            >
                              {panel.panelID}
                            </Button>
                          </td>
                          <td>{panel.panelTitle}</td>
                          <td>{panel.panelType}</td>
                          <td>
                            <Badge 
                              color={errorTypeColors[panel.errorType as keyof typeof errorTypeColors] || 'gray'}
                              text={errorTypeLabels[panel.errorType as keyof typeof errorTypeLabels] || panel.errorType}
                            />
                          </td>
                          <td>
                            <Text truncate>{panel.errorMessage}</Text>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Card.Description>
                  <div style={{ textAlign: 'center', color: 'var(--grafana-color-text-secondary)' }}>
                    <Trans i18nKey="admin.repair-tool.no-broken-panels">
                      No broken panels found with the current filters.
                    </Trans>
                  </div>
                </Card.Description>
              )}
            </Card>
          </div>

          {/* Panel Details Modal */}
          {selectedPanel && (
            <Modal
              title="Panel Details"
              isOpen={showDetailsModal}
              onDismiss={() => setShowDetailsModal(false)}
              className={styles.modalContent}
            >
              <VerticalGroup>
                <Card>
                  <Card.Heading>Panel Information</Card.Heading>
                  <Card.Description>
                    <Box>
                      <Text variant="h6">Panel ID: {selectedPanel.panelID}</Text>
                      <Text variant="h6">Title: {selectedPanel.panelTitle}</Text>
                      <Text variant="h6">Type: {selectedPanel.panelType}</Text>
                    </Box>
                  </Card.Description>
                </Card>

                <Card>
                  <Card.Heading>Error Information</Card.Heading>
                  <Card.Description>
                    <Box>
                      <Badge 
                        color={errorTypeColors[selectedPanel.errorType as keyof typeof errorTypeColors] || 'gray'}
                        text={errorTypeLabels[selectedPanel.errorType as keyof typeof errorTypeLabels] || selectedPanel.errorType}
                      />
                      <Text>{selectedPanel.errorMessage}</Text>
                    </Box>
                  </Card.Description>
                </Card>

                {selectedPanel.datasource && (
                  <Card>
                    <Card.Heading>Datasource Information</Card.Heading>
                    <Card.Description>
                      <Box>
                        <Text>UID: {selectedPanel.datasource.uid}</Text>
                        <Text>Type: {selectedPanel.datasource.type}</Text>
                        <Text>Name: {selectedPanel.datasource.name}</Text>
                      </Box>
                    </Card.Description>
                  </Card>
                )}

                {selectedPanel.position && (
                  <Card>
                    <Card.Heading>Position</Card.Heading>
                    <Card.Description>
                      <Box>
                        <Text>X: {selectedPanel.position.x}, Y: {selectedPanel.position.y}</Text>
                        <Text>Width: {selectedPanel.position.w}, Height: {selectedPanel.position.h}</Text>
                      </Box>
                    </Card.Description>
                  </Card>
                )}

                <HorizontalGroup>
                  <Button 
                    variant="secondary" 
                    onClick={() => handleInvalidateDashboardCache('')}
                  >
                    Invalidate Cache
                  </Button>
                  <Button variant="primary" onClick={() => setShowDetailsModal(false)}>
                    Close
                  </Button>
                </HorizontalGroup>
              </VerticalGroup>
            </Modal>
          )}
        </div>
      </Page.Contents>
    </Page>
  );
} 