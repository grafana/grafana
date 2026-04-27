import { css } from '@emotion/css';
import { upperFirst } from 'lodash';
import { type RefObject, useMemo, useRef } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import type { DataSourceInstanceSettings } from '@grafana/data/types';
import { Trans } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';
import { Button, Text } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';
import { useStyles2, useTheme2 } from '@grafana/ui/themes';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { type ExpressionQuery } from 'app/features/expressions/types';

import { getQueryEditorTypeConfig, type QueryEditorTypeConfig, QueryEditorType } from '../../constants';
import {
  useActionsContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
  useQueryEditorTypeConfig,
} from '../QueryEditorContext';
import { type AlertRule, type Transformation } from '../types';
import { getEditorBorderColor } from '../utils';

import { EditableQueryName } from './EditableQueryName';
import { HeaderActions } from './HeaderActions';

interface DatasourceSectionProps {
  selectedQuery: DataQuery;
  onChange: (ds: DataSourceInstanceSettings) => void;
}

function DatasourceSection({ selectedQuery, onChange }: DatasourceSectionProps) {
  const styles = useStyles2(getDatasourceSectionStyles);

  return (
    <div className={styles.dataSourcePickerWrapper}>
      <DataSourcePicker dashboard={true} variables={true} current={selectedQuery.datasource} onChange={onChange} />
    </div>
  );
}

interface PendingPickerHeaderProps {
  editorType: QueryEditorType;
  label: NonNullable<React.ReactNode>;
  onCancel?: () => void;
  cancelLabel: React.ReactNode;
  styles: ReturnType<typeof getStyles>;
  typeConfig: Record<QueryEditorType, QueryEditorTypeConfig>;
}

function PendingPickerHeader({
  editorType,
  label,
  onCancel,
  cancelLabel,
  styles,
  typeConfig,
}: PendingPickerHeaderProps) {
  return (
    <div className={styles.container}>
      <div className={styles.leftSection}>
        <Icon name={typeConfig[editorType].icon} size="sm" />
        <Text weight="light" variant="body" color="secondary">
          {label}
        </Text>
      </div>
      <Button variant="secondary" fill="text" size="sm" icon="times" onClick={onCancel}>
        {cancelLabel}
      </Button>
    </div>
  );
}

/**
 * Props for the standalone ContentHeader component.
 * This interface defines everything needed to render the header without Scene coupling.
 */
export interface ContentHeaderProps {
  selectedAlert: AlertRule | null;
  selectedQuery: DataQuery | ExpressionQuery | null;
  selectedTransformation: Transformation | null;
  queries: DataQuery[];
  cardType: QueryEditorType;
  pendingExpression?: boolean;
  onCancelPendingExpression?: () => void;
  pendingTransformation?: boolean;
  onCancelPendingTransformation?: () => void;
  onChangeDataSource: (ds: DataSourceInstanceSettings, refId: string) => void;
  onUpdateQuery: (updatedQuery: DataQuery, originalRefId: string) => void;
  isMultiSelection?: boolean;
  /**
   * Optional callback to render additional elements in the header's left section.
   *
   * Used for feature parity with legacy QueryEditorRow's renderHeaderExtras prop.
   * In the legacy component, this is used by Alerting to inject:
   * - Query options (max data points, min interval)
   * - Alert condition indicators
   * - Alerting-specific tooltips
   */
  renderHeaderExtras?: () => React.ReactNode;
  /**
   * Optional ref to the container div.
   * Used downstream for saved queries positioning.
   */
  containerRef?: RefObject<HTMLDivElement>;
  /**
   * Optional type config for query editor types (icons, colors, labels).
   * If not provided, will be computed from the current theme.
   */
  typeConfig?: Record<QueryEditorType, QueryEditorTypeConfig>;
}

/**
 * Standalone, prop-based query editor header component.
 * Can be used in both Scene-based and non-Scene contexts (e.g., Alerting, Explore).
 *
 * @remarks
 * This component is fully decoupled from React Context and Scenes state.
 * All data and callbacks are passed via props, making it reusable across
 * different architectural patterns.
 */
export function ContentHeader({
  selectedAlert,
  selectedQuery,
  selectedTransformation,
  queries,
  cardType,
  pendingExpression,
  onCancelPendingExpression,
  pendingTransformation,
  onCancelPendingTransformation,
  onChangeDataSource,
  onUpdateQuery,
  isMultiSelection,
  renderHeaderExtras,
  containerRef: externalContainerRef,
  typeConfig: typeConfigProp,
}: ContentHeaderProps) {
  // Fallback ref if none provided (for saved queries positioning)
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef || internalContainerRef;
  const theme = useTheme2();
  // Use provided typeConfig or compute from theme (for standalone usage)
  const typeConfig = useMemo(() => typeConfigProp ?? getQueryEditorTypeConfig(theme), [typeConfigProp, theme]);

  const styles = useStyles2(getStyles, { cardType, selectedAlert });

  if (pendingExpression) {
    return (
      <PendingPickerHeader
        editorType={QueryEditorType.Expression}
        label={<Trans i18nKey="query-editor-next.header.pending-expression">Select an Expression</Trans>}
        onCancel={onCancelPendingExpression}
        cancelLabel={<Trans i18nKey="query-editor-next.header.pending-expression-cancel">Cancel</Trans>}
        styles={styles}
        typeConfig={typeConfig}
      />
    );
  }

  if (pendingTransformation) {
    return (
      <PendingPickerHeader
        editorType={QueryEditorType.Transformation}
        label={<Trans i18nKey="query-editor-next.header.pending-transformation">Select a Transformation</Trans>}
        onCancel={onCancelPendingTransformation}
        cancelLabel={<Trans i18nKey="query-editor-next.header.pending-transformation-cancel">Cancel</Trans>}
        styles={styles}
        typeConfig={typeConfig}
      />
    );
  }

  if (!selectedQuery && !selectedTransformation && !selectedAlert) {
    return null;
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.leftSection}>
        <Icon name={typeConfig[cardType].icon} size="sm" />

        {cardType === QueryEditorType.Alert && selectedAlert && (
          <>
            <Text weight="light" variant="body" color="primary">
              <Trans i18nKey="query-editor-next.header.alert">Alert</Trans>
            </Text>
            <NavToolbarSeparator />
            <Text weight="light" variant="code" color="primary">
              {selectedAlert.rule.name}
            </Text>
          </>
        )}

        {cardType === QueryEditorType.Query && selectedQuery && (
          <>
            <DatasourceSection
              selectedQuery={selectedQuery}
              onChange={(ds) => onChangeDataSource(ds, selectedQuery.refId)}
            />
            <NavToolbarSeparator />
          </>
        )}

        {cardType === QueryEditorType.Expression && selectedQuery && 'type' in selectedQuery && (
          <>
            <Text weight="light" variant="body" color="primary">
              {upperFirst(selectedQuery.type)} <Trans i18nKey="query-editor-next.header.expression">Expression</Trans>
            </Text>
            <NavToolbarSeparator />
          </>
        )}

        {cardType === QueryEditorType.Transformation && selectedTransformation && (
          <>
            <Text weight="light" variant="body" color="primary">
              <Trans i18nKey="query-editor-next.header.transformation">Transformation</Trans>
            </Text>
            <NavToolbarSeparator />
            <Text weight="light" variant="code" color="primary">
              {selectedTransformation.registryItem?.name || selectedTransformation.transformConfig.id}
            </Text>
          </>
        )}

        {selectedQuery && cardType !== QueryEditorType.Alert && (
          <>
            <EditableQueryName
              key={selectedQuery.refId}
              query={selectedQuery}
              queries={queries}
              onQueryUpdate={onUpdateQuery}
              readOnly={isMultiSelection}
            />
            {renderHeaderExtras && <div className={styles.headerExtras}>{renderHeaderExtras()}</div>}
          </>
        )}
      </div>
      <HeaderActions containerRef={containerRef} />
    </div>
  );
}

/**
 * Scene-aware wrapper for ContentHeader.
 * Reads state from Scene contexts and passes as props to the standalone component.
 *
 * @remarks
 * Use this component in Scene-based contexts (e.g., Dashboard panel editing).
 * For non-Scene contexts, use ContentHeader directly with props.
 */
export function ContentHeaderSceneWrapper({
  renderHeaderExtras,
}: {
  renderHeaderExtras?: () => React.ReactNode;
} = {}) {
  const {
    selectedAlert,
    selectedQuery,
    selectedTransformation,
    selectedQueryRefIds,
    cardType,
    pendingExpression,
    setPendingExpression,
    pendingTransformation,
    setPendingTransformation,
  } = useQueryEditorUIContext();
  const { queries } = useQueryRunnerContext();
  const { changeDataSource, updateSelectedQuery } = useActionsContext();
  const typeConfig = useQueryEditorTypeConfig();

  return (
    <ContentHeader
      selectedAlert={selectedAlert}
      selectedQuery={selectedQuery}
      selectedTransformation={selectedTransformation}
      queries={queries}
      cardType={cardType}
      pendingExpression={!!pendingExpression}
      onCancelPendingExpression={() => setPendingExpression(null)}
      pendingTransformation={!!pendingTransformation}
      onCancelPendingTransformation={() => setPendingTransformation(null)}
      onChangeDataSource={changeDataSource}
      onUpdateQuery={updateSelectedQuery}
      isMultiSelection={selectedQueryRefIds.length > 1}
      renderHeaderExtras={renderHeaderExtras}
      typeConfig={typeConfig}
    />
  );
}

const getStyles = (
  theme: GrafanaTheme2,
  { cardType, selectedAlert }: { cardType: QueryEditorType; selectedAlert: AlertRule | null }
) => {
  const borderColor = getEditorBorderColor({ theme, editorType: cardType, alertState: selectedAlert?.state });

  return {
    container: css({
      position: 'relative',
      backgroundColor: theme.colors.background.secondary,
      padding: theme.spacing(0.5),
      paddingLeft: `calc(${theme.spacing(0.5)} + 4px)`,
      borderTopLeftRadius: theme.shape.radius.default,
      borderTopRightRadius: theme.shape.radius.default,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      minHeight: theme.spacing(5),

      // psuedo-element to show the border color on the left of the header
      '&::before': {
        content: '""',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        background: borderColor,
        borderTopLeftRadius: theme.shape.radius.default,
      },
    }),
    leftSection: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: `0 ${theme.spacing(0.5)}`,
    }),
    headerExtras: css({
      display: 'flex',
      alignItems: 'center',
      marginLeft: theme.spacing(1),
    }),
  };
};

// TODO: This is a hacky solution to create an inline datasource picker.
const getDatasourceSectionStyles = (theme: GrafanaTheme2) => ({
  dataSourcePickerWrapper: css({
    // Target the Input component inside the picker
    input: {
      border: 'none',
      backgroundColor: theme.colors.background.secondary,
    },
    // Remove borders from all nested divs
    '& > div, & div': {
      border: 'none',
    },
  }),
});
