import React, { useEffect, useState } from 'react';

import { Button, useStyles2 } from '@grafana/ui';

import { SelectableResourceValue } from '../api';

import getStyles from './styles';

type CrossAccountLogsQueryProps = {
  selectedLogGroups: SelectableResourceValue[];
  onChange: (selectedLogGroups: SelectableResourceValue[]) => void;
};

const MAX_VISIBLE_LOG_GROUPS = 10;

export const SelectedLogsGroups = ({ selectedLogGroups, onChange }: CrossAccountLogsQueryProps) => {
  const styles = useStyles2(getStyles);
  const [visibleSelectecLogGroups, setVisibleSelectecLogGroups] = useState(
    selectedLogGroups.slice(0, MAX_VISIBLE_LOG_GROUPS)
  );

  useEffect(() => {
    setVisibleSelectecLogGroups(selectedLogGroups.slice(0, MAX_VISIBLE_LOG_GROUPS));
  }, [selectedLogGroups]);

  return (
    <div className={styles.selectedLogGroupsContainer}>
      {visibleSelectecLogGroups.map((lg) => (
        <Button
          key={lg.value}
          size="sm"
          variant="secondary"
          icon="times"
          className={styles.removeButton}
          onClick={() => {
            onChange(selectedLogGroups.filter((slg) => slg.value !== lg.value));
          }}
        >
          {lg.label}
        </Button>
      ))}
      {visibleSelectecLogGroups.length !== selectedLogGroups.length && (
        <Button
          size="sm"
          variant="secondary"
          icon="plus"
          fill="outline"
          className={styles.removeButton}
          onClick={() => setVisibleSelectecLogGroups(selectedLogGroups)}
        >
          Show all
        </Button>
      )}
      {selectedLogGroups.length > 0 && (
        <Button
          size="sm"
          variant="secondary"
          icon="times"
          fill="outline"
          className={styles.removeButton}
          onClick={() => onChange([])}
        >
          Clear selection
        </Button>
      )}
    </div>
  );
};
