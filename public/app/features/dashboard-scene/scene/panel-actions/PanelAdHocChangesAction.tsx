import { css } from '@emotion/css';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { type DataTransformerConfig, type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { sceneGraph, type VizPanel } from '@grafana/scenes';
import { Button, Dropdown, Icon, Menu, useStyles2 } from '@grafana/ui';
import { type EffectiveTableTransformations, getEffectiveTableTransformations } from '@grafana/ui/internal';
import { TABLE_TRANSFORMATIONS_OWNER } from 'app/features/table/constants';

import { useIsMobileEditDeprecated } from '../../utils/mobileEditDeprecation';
import { getDashboardSceneLike } from '../types/dashboard';

import { PromotePanelAdHocChangesEvent, canPromoteAdHocChanges } from './promote/utils';

interface Props {
  panel: VizPanel;
}

const NO_TRANSFORMATIONS: readonly DataTransformerConfig[] = [];
const MAX_LISTED_NAMES = 3;

/**
 * Shown when viewer-only interactions (such as hiding a table column) are changing how the panel looks.
 * Anyone can remove the changes; users who can save the dashboard can also save them to it when promotion is supported.
 */
export function PanelAdHocChangesAction({ panel }: Props) {
  const { meta } = getDashboardSceneLike(panel).useState();
  // Re-render once the plugin has loaded so its declared interactions are available.
  panel.useState();
  const hasInteractions = Boolean(panel.getPlugin()?.panelInteractions);
  const changes = useEffectiveAdHocTransformations(panel, hasInteractions);
  const styles = useStyles2(getStyles);
  // Saving goes through edit mode, which is not available on small screens.
  const isMobileEditDeprecated = useIsMobileEditDeprecated();
  const canPromote = Boolean(meta.canSave) && !isMobileEditDeprecated && canPromoteAdHocChanges(panel);

  // The dashboard saves the changes, see promotePanelAdHocChanges.
  const onSaveToDashboard = useCallback(() => {
    panel.publishEvent(new PromotePanelAdHocChangesEvent({ panel }), true);
    if (panel.state.pluginId === 'table') {
      reportInteraction('grafana_table_started_promotion');
    }
  }, [panel]);

  const onRemoveChanges = useCallback(() => {
    const api = panel.getRuntimeTransformations();
    const hadChanges = api.get(TABLE_TRANSFORMATIONS_OWNER).length > 0;
    api.set(TABLE_TRANSFORMATIONS_OWNER, []);
    if (hadChanges && panel.state.pluginId === 'table') {
      reportInteraction('grafana_table_cleared_interactions');
    }
  }, [panel]);

  if (!changes || changes.transformations.length === 0) {
    return null;
  }

  const summary = getChangesSummary(changes);

  const tooltip = t('panel-adhoc-changes.tooltip', 'This panel has unsaved changes that affect its view');

  const button = (
    <Button
      variant="secondary"
      size="sm"
      fill="text"
      icon="eye"
      tooltip={tooltip}
      aria-label={tooltip}
      data-testid={selectors.components.Panels.Panel.PanelAdHocChangesHeaderAction}
    >
      <Icon name="angle-down" />
    </Button>
  );

  return (
    // Header buttons sit inside the drag handle; keep clicks from starting a panel drag. This lives on a wrapper
    // because Dropdown replaces the pointer handlers of its child. The wrapper is not itself interactive.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
    <span
      onPointerDown={(ev) => ev.stopPropagation()}
      onPointerUp={(ev) => ev.stopPropagation()}
      onClick={(ev) => ev.stopPropagation()}
    >
      <Dropdown
        placement="bottom-end"
        overlay={
          <Menu
            header={
              summary.length > 0 ? (
                <div className={styles.summary}>
                  {summary.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              ) : undefined
            }
          >
            {canPromote && (
              <Menu.Item
                label={t('panel-adhoc-changes.save-to-dashboard', 'Save to dashboard')}
                onClick={onSaveToDashboard}
              />
            )}
            <Menu.Item label={t('panel-adhoc-changes.remove-changes', 'Remove changes')} onClick={onRemoveChanges} />
          </Menu>
        }
      >
        {button}
      </Dropdown>
    </span>
  );
}

function useEffectiveAdHocTransformations(
  panel: VizPanel,
  enabled: boolean
): EffectiveTableTransformations | undefined {
  const api = panel.getRuntimeTransformations();
  const subscribe = useCallback(
    (onChange: () => void) => (enabled ? api.subscribe(TABLE_TRANSFORMATIONS_OWNER, onChange) : () => {}),
    [api, enabled]
  );
  const getSnapshot = useCallback(
    () => (enabled ? api.get(TABLE_TRANSFORMATIONS_OWNER) : NO_TRANSFORMATIONS),
    [api, enabled]
  );
  const transformations = useSyncExternalStore(subscribe, getSnapshot);
  const dataState = sceneGraph.getData(panel).useState().data?.state;
  const sourceSeries = transformations.length > 0 ? api.getSourceSeries(TABLE_TRANSFORMATIONS_OWNER) : undefined;

  return useMemo(
    () => (sourceSeries ? getEffectiveTableTransformations(transformations, sourceSeries, dataState) : undefined),
    [transformations, sourceSeries, dataState]
  );
}

function getChangesSummary({ hiddenColumns, reordered, filteredFields }: EffectiveTableTransformations): string[] {
  const summary: string[] = [];

  if (hiddenColumns.length > 0) {
    summary.push(
      t('panel-adhoc-changes.summary.hidden-columns', 'Hidden columns: {{columns}}', {
        columns: listNames(hiddenColumns),
        interpolation: { escapeValue: false },
      })
    );
  }

  if (reordered) {
    summary.push(t('panel-adhoc-changes.summary.reordered', 'Columns reordered'));
  }

  if (filteredFields.length > 0) {
    summary.push(
      t('panel-adhoc-changes.summary.filtered-by', 'Filtered by: {{fields}}', {
        fields: listNames(filteredFields),
        interpolation: { escapeValue: false },
      })
    );
  }

  return summary;
}

function listNames(names: string[]): string {
  if (names.length <= MAX_LISTED_NAMES) {
    return names.join(', ');
  }

  return t('panel-adhoc-changes.summary.more-names', '', {
    names: names.slice(0, MAX_LISTED_NAMES).join(', '),
    count: names.length - MAX_LISTED_NAMES,
    defaultValue_one: '{{names}} and {{count}} more',
    defaultValue_other: '{{names}} and {{count}} more',
    interpolation: { escapeValue: false },
  });
}

const getStyles = (theme: GrafanaTheme2) => ({
  summary: css({
    ...theme.typography.bodySmall,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    maxWidth: theme.spacing(40),
    padding: theme.spacing(0, 1),
    overflowWrap: 'anywhere',
    color: theme.colors.text.secondary,
  }),
});
