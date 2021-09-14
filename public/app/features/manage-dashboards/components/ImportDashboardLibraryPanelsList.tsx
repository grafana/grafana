import React, { ReactElement } from 'react';
import { Icon, Legend, Tooltip, useStyles2 } from '@grafana/ui';

import { LibraryPanelInput, LibraryPanelInputState } from '../state/reducers';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { LibraryPanelCard } from '../../library-panels/components/LibraryPanelCard/LibraryPanelCard';

interface ImportDashboardLibraryPanelsListProps {
  inputs: LibraryPanelInput[];
  folderName?: string;
}

export function ImportDashboardLibraryPanelsList({
  inputs,
  folderName,
}: ImportDashboardLibraryPanelsListProps): ReactElement | null {
  const styles = useStyles2(getStyles);

  if (!Boolean(inputs?.length)) {
    return null;
  }

  return (
    <div className={styles.spacer}>
      <Legend>Library panels</Legend>
      <div>
        {inputs.map((input, index) => {
          const libraryPanelIndex = `elements[${index}]`;
          const tooltip =
            input.state === LibraryPanelInputState.Different
              ? `The uid:${input.model.uid} is already used by a different library panel so this library panel will not be imported and the existing will be used instead.`
              : input.state === LibraryPanelInputState.Exits
              ? `This library panel already exists so it will not be re-imported.`
              : 'This library panel will be imported.';
          const iconName = input.state === LibraryPanelInputState.Different ? 'exclamation-triangle' : 'info-circle';
          const iconClass = input.state === LibraryPanelInputState.Different ? styles.iconError : styles.iconOk;
          const libraryPanel = { ...input.model, meta: { ...input.model.meta, folderName: folderName ?? 'General' } };
          return (
            <div key={libraryPanelIndex} className={styles.item}>
              <div className={styles.card}>
                <LibraryPanelCard libraryPanel={libraryPanel} onClick={() => undefined} />
              </div>
              <Tooltip content={tooltip}>
                <Icon name={iconName} size="xl" className={iconClass} />
              </Tooltip>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    spacer: css`
      margin-bottom: ${theme.spacing(2)};
    `,
    item: css`
      display: flex;
      align-items: center;
      margin-bottom: ${theme.spacing(1)};
    `,
    card: css`
      flex-grow: 1;
    `,
    iconError: css`
      margin-left: ${theme.spacing(1)};
      fill: ${theme.colors.warning.main};
    `,
    iconOk: css`
      margin-left: ${theme.spacing(1)};
      fill: ${theme.colors.info.main};
    `,
  };
}
