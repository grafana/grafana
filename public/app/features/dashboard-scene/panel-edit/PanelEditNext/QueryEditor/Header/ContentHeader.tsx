import { css } from '@emotion/css';
import { upperFirst } from 'lodash';
import { RefObject, useRef } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { DataQuery } from '@grafana/schema';
import { useStyles2, Icon, Text } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { ExpressionQuery } from 'app/features/expressions/types';

import { QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../../constants';
import { useActionsContext, useQueryEditorUIContext, useQueryRunnerContext } from '../QueryEditorContext';
import { Transformation } from '../types';

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

/**
 * Props for the standalone ContentHeader component.
 * This interface defines everything needed to render the header without Scene coupling.
 */
export interface ContentHeaderProps {
  selectedQuery: DataQuery | ExpressionQuery | null;
  selectedTransformation: Transformation | null;
  queries: DataQuery[];
  cardType: QueryEditorType;
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
  selectedQuery,
  selectedTransformation,
  queries,
  cardType,
  onChangeDataSource,
  onUpdateQuery,
  renderHeaderExtras,
  containerRef: externalContainerRef,
}: ContentHeaderProps) {
  // Fallback ref if none provided (for saved queries positioning)
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef || internalContainerRef;

  const styles = useStyles2(getStyles, { cardType });

  if (!selectedQuery && !selectedTransformation) {
    return null;
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.leftSection}>
        <Icon name={QUERY_EDITOR_TYPE_CONFIG[cardType].icon} size="sm" />

        {cardType === QueryEditorType.Query && selectedQuery && (
          <>
            <DatasourceSection
              selectedQuery={selectedQuery}
              onChange={(ds) => onChangeDataSource(ds, selectedQuery.refId)}
            />
            <Separator />
          </>
        )}

        {cardType === QueryEditorType.Expression && selectedQuery && 'type' in selectedQuery && (
          <>
            <Text weight="light" variant="body" color="primary">
              {upperFirst(selectedQuery.type)} <Trans i18nKey="query-editor.header.expression">Expression</Trans>
            </Text>
            <Separator />
          </>
        )}

        {cardType === QueryEditorType.Transformation && selectedTransformation && (
          <>
            <Text weight="light" variant="body" color="primary">
              <Trans i18nKey="query-editor.header.transformation">Transformation</Trans>
            </Text>
            <Separator />
            <Text weight="light" variant="code" color="primary">
              {selectedTransformation.registryItem?.name || selectedTransformation.transformConfig.id}
            </Text>
          </>
        )}

        {selectedQuery && (
          <>
            <EditableQueryName query={selectedQuery} queries={queries} onQueryUpdate={onUpdateQuery} />
            {renderHeaderExtras && <div className={styles.headerExtras}>{renderHeaderExtras()}</div>}
          </>
        )}
      </div>
      <HeaderActions queries={queries} containerRef={containerRef} />
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
  const { selectedQuery, selectedTransformation, cardType } = useQueryEditorUIContext();
  const { queries } = useQueryRunnerContext();
  const { changeDataSource, updateSelectedQuery } = useActionsContext();

  return (
    <ContentHeader
      selectedQuery={selectedQuery}
      selectedTransformation={selectedTransformation}
      queries={queries}
      cardType={cardType}
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

const getStyles = (theme: GrafanaTheme2, { cardType }: { cardType: QueryEditorType }) => {
  return {
    container: css({
      borderLeft: `4px solid ${QUERY_EDITOR_TYPE_CONFIG[cardType].color}`,
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
