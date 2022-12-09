import { css } from '@emotion/css';
import React, { ReactElement } from 'react';

import { Button, useStyles2 } from '@grafana/ui';

import { PluginRecipe } from '../types';

import { Steps } from './Steps';

type Props = {
  recipe: PluginRecipe;

  // Tells if the whole recipe is installed
  isInstalled: boolean;

  // Tells if the install is in progress
  isInstallInProgress: boolean;

  onRunInstall: () => void;
};

export function DetailsStatus({ recipe, isInstalled, isInstallInProgress, onRunInstall }: Props): ReactElement {
  const styles = useStyles2(getStyles);

  // Display the steps immadiately after clicking install (and also if the recipe has been installed)
  if (isInstallInProgress || isInstalled) {
    return (
      <div>
        <Steps recipe={recipe} />
      </div>
    );
  }

  return (
    <div className={styles.notInstalledContainer}>
      <div className={styles.notInstalledText}>Start monitoring your service now!</div>
      <div>
        <Button size="lg" onClick={onRunInstall}>
          Install
        </Button>
      </div>
    </div>
  );
}

const getStyles = () => ({
  notInstalledContainer: css`
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
  `,

  notInstalledText: css`
    margin-bottom: 20px;
    margin-top: 30px;
    font-size: 15px;
    color: #ffffff69;
  `,
});
