import { css, cx } from '@emotion/css';
import { type RefObject, useCallback, useId, useMemo, useRef } from 'react';

import { type DataSourceInstanceSettings, type GrafanaTheme2, type ScopedVars } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';
import { Button, Icon, Text, useStyles2, useTheme2 } from '@grafana/ui';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { type ExpressionQuery } from 'app/features/expressions/types';

import { getQueryEditorTypeConfig, type QueryEditorTypeConfig, QueryEditorType } from '../../constants';
import { type CardActionSource } from '../../tracking';
import {
  useActionsContext,
  usePanelContext,
  useQueryEditorUIContext,
  useQueryRunnerContext,
  useQueryEditorTypeConfig,
} from '../QueryEditorContext';
import { usePanelScopedVars } from '../hooks/usePanelScopedVars';
import { type AlertRule, type Transformation } from '../types';
import { getEditorBorderColor, getExpressionSectionLabel, truncatedTextStyles } from '../utils';

import { EditableQueryName } from './EditableQueryName';
import { HeaderActions } from './HeaderActions';
import { TransformationIdentifier } from './TransformationIdentifier';
import { type HeaderActionTarget } from './headerActionTarget';

interface DatasourceSectionProps {
  selectedQuery: DataQuery;
  onChange: (ds: DataSourceInstanceSettings) => void;
  currentDatasource?: DataSourceInstanceSettings;
  scopedVars?: ScopedVars;
}

function DatasourceSection({ selectedQuery, onChange, currentDatasource, scopedVars }: DatasourceSectionProps) {
  const styles = useStyles2(getDatasourceSectionStyles);
  // The stacked view renders one picker per query, and the picker's default id is shared.
  const inputId = useId();

  return (
    <div className={styles.dataSourcePickerWrapper}>
      <DataSourcePicker
        inputId={inputId}
        dashboard={true}
        variables={true}
        current={currentDatasource ?? selectedQuery.datasource}
        onChange={onChange}
        scopedVars={scopedVars}
      />
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
interface ContentHeaderProps {
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
  currentDatasource?: DataSourceInstanceSettings;
  scopedVars?: ScopedVars;
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
   * Renders the selected transformation's name. Supplied by the Scene wrapper, which can reach the
   * pipeline state the editable name needs; without it the registry name is shown as plain text.
   */
  renderTransformationName?: (transformation: Transformation) => React.ReactNode;
  /**
   * Optional ref to the container div.
   * Used downstream for saved queries positioning.
   */
  containerRef?: RefObject<HTMLDivElement | null>;
  /**
   * Optional type config for query editor types (icons, colors, labels).
   * If not provided, will be computed from the current theme.
   */
  typeConfig?: Record<QueryEditorType, QueryEditorTypeConfig>;
  /** The card the header actions act on. Defaults to the selected card. */
  target?: HeaderActionTarget;
  /** `stacked` renders the header inside a stacked view section, which draws its own accent bar. */
  variant?: ContentHeaderVariant;
  /** Analytics source reported by the header actions. */
  source?: CardActionSource;
}

type ContentHeaderVariant = 'default' | 'stacked';

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
  renderHeaderExtras,
  renderTransformationName,
  containerRef: externalContainerRef,
  typeConfig: typeConfigProp,
  currentDatasource,
  scopedVars,
  target,
  variant = 'default',
  source = 'content_header',
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
        label={<Trans i18nKey="query-editor-next.header.pending-expression">Select an expression</Trans>}
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
        label={<Trans i18nKey="query-editor-next.header.pending-transformation">Select a transformation</Trans>}
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

  const isStacked = variant === 'stacked';

  return (
    <div className={cx(styles.container, isStacked && styles.stackedContainer)} ref={containerRef}>
      <div className={styles.leftSection}>
        <Icon name={typeConfig[cardType].icon} size="sm" />

        {cardType === QueryEditorType.Alert && selectedAlert && (
          <>
            <Text weight="light" variant="body" color="primary">
              <Trans i18nKey="query-editor-next.header.alert">Alert</Trans>
            </Text>
            <NavToolbarSeparator />
            <span className={styles.truncatedName} title={selectedAlert.rule.name}>
              <Text weight="light" variant="body" color="primary">
                {selectedAlert.rule.name}
              </Text>
            </span>
          </>
        )}

        {cardType === QueryEditorType.Query && selectedQuery && (
          <>
            <DatasourceSection
              selectedQuery={selectedQuery}
              onChange={(ds) => onChangeDataSource(ds, selectedQuery.refId)}
              currentDatasource={currentDatasource}
              scopedVars={scopedVars}
            />
            <NavToolbarSeparator />
          </>
        )}

        {cardType === QueryEditorType.Expression && selectedQuery && 'type' in selectedQuery && (
          <>
            <Text weight="light" variant="body" color="primary">
              {getExpressionSectionLabel(selectedQuery)}
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
            {renderTransformationName ? (
              renderTransformationName(selectedTransformation)
            ) : (
              <Text weight="light" variant="body" color="primary">
                {selectedTransformation.registryItem?.name || selectedTransformation.transformConfig.id}
              </Text>
            )}
          </>
        )}

        {selectedQuery && cardType !== QueryEditorType.Alert && (
          <>
            <span className={styles.queryName}>
              <EditableQueryName
                key={selectedQuery.refId}
                query={selectedQuery}
                queries={queries}
                onQueryUpdate={onUpdateQuery}
              />
            </span>
            {renderHeaderExtras && <div className={styles.headerExtras}>{renderHeaderExtras()}</div>}
          </>
        )}
      </div>
      <div className={styles.actions}>
        <HeaderActions containerRef={containerRef} target={target} source={source} />
      </div>
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
  target,
  variant,
}: {
  renderHeaderExtras?: () => React.ReactNode;
  /** Renders the header for this card instead of the selected one. */
  target?: HeaderActionTarget;
  variant?: ContentHeaderVariant;
} = {}) {
  const uiState = useQueryEditorUIContext();
  const { pendingExpression, setPendingExpression, pendingTransformation, setPendingTransformation } = uiState;
  const { queries, data } = useQueryRunnerContext();
  const { transformations } = usePanelContext();
  const { changeDataSource, updateSelectedQuery, updateTransformation } = useActionsContext();
  const typeConfig = useQueryEditorTypeConfig();
  const scopedVars = usePanelScopedVars();

  const renderTransformationName = useCallback(
    (transformation: Transformation) => (
      <TransformationIdentifier
        transformation={transformation}
        transformations={transformations}
        data={data}
        fallbackName={transformation.registryItem?.name || transformation.transformConfig.id}
        onUpdate={updateTransformation}
      />
    ),
    [transformations, data, updateTransformation]
  );

  // A targeted header describes one existing card, so the selection's alert and pending pickers don't apply.
  const card = target
    ? {
        selectedAlert: null,
        selectedQuery: target.cardType === QueryEditorType.Transformation ? null : target.query,
        selectedTransformation: target.cardType === QueryEditorType.Transformation ? target.transformation : null,
        cardType: target.cardType,
        currentDatasource: target.cardType === QueryEditorType.Transformation ? undefined : target.dsData?.dsSettings,
        pendingExpression: false,
        pendingTransformation: false,
      }
    : {
        selectedAlert: uiState.selectedAlert,
        selectedQuery: uiState.selectedQuery,
        selectedTransformation: uiState.selectedTransformation,
        cardType: uiState.cardType,
        currentDatasource: uiState.selectedQueryDsData?.dsSettings,
        pendingExpression: !!pendingExpression,
        pendingTransformation: !!pendingTransformation,
      };

  return (
    <ContentHeader
      {...card}
      renderTransformationName={renderTransformationName}
      queries={queries}
      onCancelPendingExpression={() => setPendingExpression(null)}
      onCancelPendingTransformation={() => setPendingTransformation(null)}
      onChangeDataSource={changeDataSource}
      onUpdateQuery={updateSelectedQuery}
      renderHeaderExtras={renderHeaderExtras}
      typeConfig={typeConfig}
      scopedVars={scopedVars}
      target={target}
      variant={variant}
      source={uiState.stackedMode.enabled ? 'stacked_header' : 'content_header'}
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
      padding: theme.spacing(0.5),
      paddingLeft: `calc(${theme.spacing(0.5)} + 4px)`,
      borderTopLeftRadius: theme.shape.radius.default,
      borderTopRightRadius: theme.shape.radius.default,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      minHeight: theme.spacing(5),
      borderBottom: `1px solid ${theme.colors.border.weak}`,

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
    stackedContainer: css({
      background: theme.colors.background.secondary,
      '&::before': {
        content: 'none',
      },
    }),
    // No overflow clipping here: it would cut off the rename validation message that hangs below the name.
    leftSection: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: `0 ${theme.spacing(0.5)}`,
      flex: '1 1 auto',
      minWidth: 0,
      whiteSpace: 'nowrap',
    }),
    actions: css({
      flexShrink: 0,
    }),
    // The data source picker gives up width first, so the query name stays readable.
    queryName: css({
      flexShrink: 0,
    }),
    truncatedName: css(truncatedTextStyles),
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
    minWidth: 0,
    // Target the Input component inside the picker
    input: {
      border: 'none',
    },
    // Remove borders from all nested divs
    '& > div, & div': {
      border: 'none',
    },
  }),
});
