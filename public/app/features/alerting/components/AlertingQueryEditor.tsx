import React, { FC, useState } from 'react';
import { css } from 'emotion';
import { DataSourceSelectItem, GrafanaTheme } from '@grafana/data';
import { Collapse, useStyles } from '@grafana/ui';
import DataSourcePicker from '../../../core/components/Select/DataSourcePicker';

interface Props {
  dataSources: DataSourceSelectItem[];
  onChangeDataSource: (item: DataSourceSelectItem) => void;
}

export const AlertingQueryEditor: FC<Props> = ({ dataSources, onChangeDataSource }) => {
  const styles = useStyles(getStyles);

  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className={styles.container}>
      <Collapse label="Queries" collapsible isOpen={isOpen} onToggle={setIsOpen}>
        <DataSourcePicker datasources={dataSources} onChange={() => {}} />
      </Collapse>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      padding: 0 ${theme.spacing.md};
      background-color: ${theme.colors.panelBg};
    `,
    editorWrapper: css`
      border: 1px solid ${theme.colors.panelBorder};
      border-radius: ${theme.border.radius.md};
    `,
  };
};
