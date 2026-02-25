import { css } from '@emotion/css';
import { upperFirst } from 'lodash';
import { RefObject, useRef } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { Button, Icon, Text, useStyles2 } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { ExpressionQuery } from 'app/features/expressions/types';

import { QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../../constants';
import { useActionsContext, useQueryEditorUIContext, useQueryRunnerContext } from '../QueryEditorContext';
import { AlertRule, Transformation } from '../types';
import { getDisplayType, getEditorBorderColor } from '../utils';

import { EditableQueryName } from './EditableQueryName';
import { HeaderActions } from './HeaderActions';

function DatasourceSection({ selectedQuery, onChange }: DatasourceSectionProps) {
  const styles = useStyles2(getDatasourceSectionStyles);

  return (
    <div className={styles.dataSourcePickerWrapper}>
      <DataSourcePicker dashboard={true} variables={true} current={selectedQuery.datasource} onChange={onChange} />
    </div>
  );
}

const Separator = () => (
  <Text variant="h4" color="secondary">
    /
  </Text>
);

interface PendingPickerHeaderProps {
  editorType: QueryEditorType;
  label: NonNullable<React.ReactNode>;
  onCancel?: () => void;
  cancelLabel: React.ReactNode;
  styles: ReturnType<typeof getStyles>;
}

function PendingPickerHeader({ editorType, label, onCancel, cancelLabel, styles }: PendingPickerHeaderProps) {
  return (
    <div className={styles.container}>
      <div className={styles.leftSection}>
        <Icon name={QUERY_EDITOR_TYPE_CONFIG[editorType].icon} size="sm" />
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
  selectedQuery: DataQuery | null;
  selectedExpression: ExpressionQuery | null;
  selectedTransformation: Transformation | null;
  queries: DataQuery[];
  pendingExpression?: boolean;
  onCancelPendingExpression?: () => void;
  pendingTransformation?: boolean;
  onCancelPendingTransformation?: () => void;
  onChangeDataSource: (ds: DataSourceInstanceSettings, refId: string) => void;
  onUpdateQuery: (updatedQuery: DataQuery, originalRefId: string) => void;
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
  selectedExpression,
  selectedTransformation,
  queries,
  pendingExpression,
  onCancelPendingExpression,
  pendingTransformation,
  onCancelPendingTransformation,
  onChangeDataSource,
  onUpdateQuery,
  renderHeaderExtras,
  containerRef: externalContainerRef,
}: ContentHeaderProps) {
  // Fallback ref if none provided (for saved queries positioning)
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef || internalContainerRef;

  const displayType = getDisplayType(selectedAlert, selectedTransformation, selectedQuery, selectedExpression);
  const styles = useStyles2(getStyles, { cardType: displayType, selectedAlert });

  if (pendingExpression) {
    return (
      <PendingPickerHeader
        editorType={QueryEditorType.Expression}
        label={<Trans i18nKey="query-editor-next.header.pending-expression">Select an Expression</Trans>}
        onCancel={onCancelPendingExpression}
        cancelLabel={<Trans i18nKey="query-editor-next.header.pending-expression-cancel">Cancel</Trans>}
        styles={styles}
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
      />
    );
  }

  if (!selectedQuery && !selectedExpression && !selectedTransformation && !selectedAlert) {
    return null;
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.leftSection}>
        <Icon name={QUERY_EDITOR_TYPE_CONFIG[displayType].icon} size="sm" />

        {selectedAlert && (
          <>
            <Text weight="light" variant="body" color="primary">
              <Trans i18nKey="query-editor-next.header.alert">Alert</Trans>
            </Text>
            <Separator />
            <Text weight="light" variant="code" color="primary">
              {selectedAlert.rule.name}
            </Text>
          </>
        )}

        {selectedQuery && (
          <>
            <DatasourceSection
              selectedQuery={selectedQuery}
              onChange={(ds) => onChangeDataSource(ds, selectedQuery.refId)}
            />
            <Separator />
          </>
        )}

        {selectedExpression && (
          <>
            <Text weight="light" variant="body" color="primary">
              {upperFirst(selectedExpression.type)} <Trans i18nKey="query-editor-next.header.expression">Expression</Trans>
            </Text>
            <Separator />
          </>
        )}

        {selectedTransformation && (
          <>
            <Text weight="light" variant="body" color="primary">
              <Trans i18nKey="query-editor-next.header.transformation">Transformation</Trans>
            </Text>
            <Separator />
            <Text weight="light" variant="code" color="primary">
              {selectedTransformation.registryItem?.name || selectedTransformation.transformConfig.id}
            </Text>
          </>
        )}

        {(selectedQuery || selectedExpression) && (
          <>
            <EditableQueryName
              query={selectedQuery ?? selectedExpression!}
              queries={queries}
              onQueryUpdate={onUpdateQuery}
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
  const { activeContext, selectedAlert, selectedQuery, selectedExpression, selectedTransformation, setActiveContext } =
    useQueryEditorUIContext();
  const { queries } = useQueryRunnerContext();
  const { changeDataSource, updateSelectedQuery } = useActionsContext();

  const isExpressionPicker =
    activeContext.view === 'data' && activeContext.selection.kind === 'expressionPicker';
  const isTransformationPicker =
    activeContext.view === 'data' && activeContext.selection.kind === 'transformationPicker';

  return (
    <ContentHeader
      selectedAlert={selectedAlert}
      selectedQuery={selectedQuery}
      selectedExpression={selectedExpression}
      selectedTransformation={selectedTransformation}
      queries={queries}
      pendingExpression={isExpressionPicker}
      onCancelPendingExpression={() => setActiveContext({ view: 'data', selection: { kind: 'none' } })}
      pendingTransformation={isTransformationPicker}
      onCancelPendingTransformation={() => setActiveContext({ view: 'data', selection: { kind: 'none' } })}
      onChangeDataSource={changeDataSource}
      onUpdateQuery={updateSelectedQuery}
      renderHeaderExtras={renderHeaderExtras}
    />
  );
}

interface DatasourceSectionProps {
  selectedQuery: DataQuery;
  onChange: (ds: DataSourceInstanceSettings) => void;
}

const getStyles = (
  theme: GrafanaTheme2,
  { cardType, selectedAlert }: { cardType: QueryEditorType; selectedAlert: AlertRule | null }
) => {
  const borderColor = getEditorBorderColor({ theme, editorType: cardType, alertState: selectedAlert?.state });

  return {
    container: css({
      borderLeft: `4px solid ${borderColor}`,
      backgroundColor: theme.colors.background.secondary,
      padding: theme.spacing(0.5),
      borderTopLeftRadius: theme.shape.radius.default,
      borderTopRightRadius: theme.shape.radius.default,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      minHeight: theme.spacing(5),
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
