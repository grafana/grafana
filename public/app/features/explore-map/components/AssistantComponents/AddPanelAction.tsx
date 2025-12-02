import { css } from '@emotion/css';
import React, { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { useDispatch } from 'app/types/store';

import { addPanel } from '../../state/crdtSlice';

/**
 * Whitelisted props that the Grafana Assistant allows for custom components.
 * We creatively map these to our needs:
 * - type: Panel type ('explore', 'metrics', 'logs', 'traces', 'profiles')
 * - description: Custom button label (optional)
 * - name: Display name (optional)
 * - namespace: Datasource UID
 * - metric: Query expression (PromQL, LogQL, etc.)
 */
interface AddPanelActionProps {
  name?: string; // Display name
  type?: string; // Panel type: 'explore' | 'metrics' | 'logs' | 'traces' | 'profiles'
  description?: string; // Custom button label
  properties?: string; // Reserved
  env?: string; // Reserved
  site?: string; // Reserved
  namespace?: string; // Datasource UID
  metric?: string; // Query expression
  value?: string; // Reserved
  unit?: string; // Reserved
  status?: string; // Reserved
}

/**
 * Custom component that the Grafana Assistant can use to add panels to the explore map canvas.
 * The assistant can render this component in its responses to provide interactive "Add Panel" buttons.
 *
 * Uses whitelisted props only:
 * - type: Panel type ('explore', 'metrics', 'logs', 'traces', 'profiles')
 * - description: Custom button label (optional)
 * - name: Display name (optional)
 * - namespace: Datasource UID (optional)
 * - metric: Query expression (optional)
 */
export const AddPanelAction: React.FC<AddPanelActionProps> = ({
  type = 'explore',
  description,
  name,
  namespace, // datasourceUid
  metric, // query expression
}) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const currentUsername = contextSrv.user.name || contextSrv.user.login || 'Unknown';

  // Map type to the internal mode format
  const getMode = (): 'explore' | 'traces-drilldown' | 'metrics-drilldown' | 'profiles-drilldown' | 'logs-drilldown' => {
    switch (type?.toLowerCase()) {
      case 'traces':
        return 'traces-drilldown';
      case 'metrics':
        return 'metrics-drilldown';
      case 'profiles':
        return 'profiles-drilldown';
      case 'logs':
        return 'logs-drilldown';
      default:
        return 'explore';
    }
  };

  const handleAddPanel = useCallback(() => {
    // Decode the metric if it's URL-encoded
    const decodedQuery = metric ? decodeURIComponent(metric) : undefined;
    const mode = getMode();

    dispatch(
      addPanel({
        viewportSize: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        kind: mode,
        createdBy: currentUsername,
        datasourceUid: namespace, // Use namespace prop for datasource UID
        query: decodedQuery, // Decode URL-encoded query expression
      })
    );
  }, [dispatch, currentUsername, type, namespace, metric, getMode]);

  const getButtonLabel = () => {
    if (description) {
      return description;
    }
    if (name) {
      return name;
    }
    switch (getMode()) {
      case 'traces-drilldown':
        return 'Add Traces Panel';
      case 'metrics-drilldown':
        return 'Add Metrics Panel';
      case 'profiles-drilldown':
        return 'Add Profiles Panel';
      case 'logs-drilldown':
        return 'Add Logs Panel';
      default:
        return 'Add Explore Panel';
    }
  };

  const getButtonIcon = () => {
    switch (getMode()) {
      case 'traces-drilldown':
      case 'metrics-drilldown':
      case 'profiles-drilldown':
      case 'logs-drilldown':
        return 'plus';
      default:
        return 'compass';
    }
  };

  return (
    <div className={styles.container}>
      <Button icon={getButtonIcon()} onClick={handleAddPanel} variant="primary" size="sm">
        {getButtonLabel()}
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'inline-block',
      margin: theme.spacing(1, 0),
    }),
  };
};
