import React, { FC } from 'react';
import { PageToolbar, ToolbarButton, stylesFactory } from '@grafana/ui';

import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
import { config } from 'app/core/config';
import AlertTypeSection from './components/AlertTypeSection';
import AlertConditionsSection from './components/AlertConditionsSection';
import AlertDetails from './components/AlertDetails';

type Props = {};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    formWrapper: css`
      padding: 0 16px;
    `,
    formInput: css`
      width: 400px;
      & + & {
        margin-left: 8px;
      }
    `,
    flexRow: css`
      display: flex;
      flex-direction: row;
      justify-content: flex-start;
    `,
  };
});

const AlertEditor: FC<Props> = () => {
  const styles = getStyles(config.theme);
  return (
    <div>
      <PageToolbar title="Create alert rule" pageIcon="bell">
        <ToolbarButton variant="primary">Save</ToolbarButton>
        <ToolbarButton variant="primary">Save and exit</ToolbarButton>
        <ToolbarButton variant="destructive">Cancel</ToolbarButton>
      </PageToolbar>
      <div className={styles.formWrapper}>
        <AlertTypeSection />
        <AlertConditionsSection />
        <AlertDetails />
      </div>
    </div>
  );
};

export default AlertEditor;
