import { css } from '@emotion/css';
import { useRef } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { useStyles2, Icon, Text } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../../constants';
import { useActionsContext, useQueryEditorUIContext, useQueryRunnerContext } from '../QueryEditorContext';
import { getEditorType } from '../utils';

import { EditableQueryName } from './EditableQueryName';
import { HeaderActions } from './HeaderActions';

interface ContentHeaderProps {
  /**
   * Optional callback to render additional elements in the header's left section.
   *
   * Used for feature parity with legacy QueryEditorRow's renderHeaderExtras prop.
   * In the legacy component, this is used by Alerting to inject:
   * - Query options (max data points, min interval)
   * - Alert condition indicators
   * - Alerting-specific tooltips
   *
   * Currently not wired up in the v2 dashboard query editor flow.
   * Will be needed when/if Alerting or other contexts adopt the v2 experience.
   */
  renderHeaderExtras?: () => React.ReactNode;
}

export function ContentHeader({ renderHeaderExtras }: ContentHeaderProps = {}) {
  const { selectedQuery, selectedTransformation } = useQueryEditorUIContext();
  const { queries } = useQueryRunnerContext();
  const { changeDataSource, updateSelectedQuery } = useActionsContext();

  // This ref is used downstream for the saved queries experience. It's used specifically within
  // renderSavedQueryButtons to determine the width of the container for positioning the saved queries dropdown.
  const containerRef = useRef<HTMLDivElement>(null);

  const cardType = getEditorType(selectedQuery);
  const styles = useStyles2(getStyles, { cardType });

  // We have to do defensive null checks since queries might be an empty array :(
  if (!selectedQuery && !selectedTransformation) {
    return null;
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.leftSection}>
        <Icon name={QUERY_EDITOR_TYPE_CONFIG[cardType].icon} size="sm" />
        {cardType === QueryEditorType.Query && selectedQuery && (
          <DatasourceSection
            selectedCard={selectedQuery}
            onChange={(ds) => changeDataSource(ds, selectedQuery.refId)}
          />
        )}
        {selectedQuery && (
          <>
            <EditableQueryName query={selectedQuery} queries={queries} onQueryUpdate={updateSelectedQuery} />
            {renderHeaderExtras && <div className={styles.headerExtras}>{renderHeaderExtras()}</div>}
          </>
        )}
        {selectedTransformation && (
          <Text weight="light" variant="body" color="primary">
            {selectedTransformation.registryItem?.name || selectedTransformation.transformConfig.id}
          </Text>
        )}
      </div>
      {selectedQuery && (
        <HeaderActions cardType={cardType} query={selectedQuery} queries={queries} containerRef={containerRef} />
      )}
    </div>
  );
}

interface DatasourceSectionProps {
  selectedCard: DataQuery;
  onChange: (ds: DataSourceInstanceSettings) => void;
}

function DatasourceSection({ selectedCard, onChange }: DatasourceSectionProps) {
  const styles = useStyles2(getDatasourceSectionStyles);

  return (
    <>
      <div className={styles.dataSourcePickerWrapper}>
        <DataSourcePicker dashboard={true} variables={true} current={selectedCard.datasource} onChange={onChange} />
      </div>
      <Text variant="h4" color="secondary">
        /
      </Text>
    </>
  );
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
