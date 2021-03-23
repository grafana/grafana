import { DateTimeInput, GrafanaTheme } from '@grafana/data';
import { stylesFactory, useStyles } from '@grafana/ui';
import { OptionsGroup } from 'app/features/dashboard/components/PanelEditor/OptionsGroup';
import { PanelModel } from 'app/features/dashboard/state';
import { css } from 'emotion';
import React from 'react';

interface Props {
  panel: PanelModel & Required<Pick<PanelModel, 'libraryPanel'>>;
  formatDate?: (dateString: DateTimeInput, format?: string) => string;
}

export const LibraryPanelInformation: React.FC<Props> = ({ panel, formatDate }) => {
  const styles = useStyles(getStyles);

  return (
    <OptionsGroup title="Reusable panel information" id="Shared Panel Info" key="Shared Panel Info">
      {panel.libraryPanel.uid && (
        <p className={styles.libraryPanelInfo}>
          {`Used on ${panel.libraryPanel.meta.connectedDashboards} `}
          {panel.libraryPanel.meta.connectedDashboards === 1 ? 'dashboard' : 'dashboards'}
          <br />
          Last edited on {formatDate?.(panel.libraryPanel.meta.updated, 'L') ?? panel.libraryPanel.meta.updated} by
          {panel.libraryPanel.meta.updatedBy.avatarUrl && (
            <img
              width="22"
              height="22"
              className={styles.userAvatar}
              src={panel.libraryPanel.meta.updatedBy.avatarUrl}
              alt={`Avatar for ${panel.libraryPanel.meta.updatedBy.name}`}
            />
          )}
          {panel.libraryPanel.meta.updatedBy.name}
        </p>
      )}
    </OptionsGroup>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    libraryPanelInfo: css`
      color: ${theme.colors.textSemiWeak};
      font-size: ${theme.typography.size.sm};
    `,
    userAvatar: css`
      border-radius: 50%;
      box-sizing: content-box;
      width: 22px;
      height: 22px;
      padding-left: ${theme.spacing.sm};
      padding-right: ${theme.spacing.sm};
    `,
  };
});
