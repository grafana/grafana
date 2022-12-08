import { css } from '@emotion/css';
import React, { ReactElement } from 'react';

import { Button, useStyles2 } from '@grafana/ui';

import { PluginRecipe } from '../types';

import { Steps } from './Steps';

type Props = {
  recipe: PluginRecipe;
  // Can be called to start or continue the install
  onInstall: () => void;

  // Tells if the whole recipe is installed
  isInstalled: boolean;

  // Tells if the install has been initiated by the user (but maybe haven't been updated in the DTO status yet)
  isInstallStarted: boolean;
};

export function DetailsStatus({ recipe, onInstall, isInstalled, isInstallStarted }: Props): ReactElement {
  const styles = useStyles2(getStyles);

  if (!isInstalled) {
    return (
      <div className={styles.notInstalledContainer}>
        <div className={styles.notInstalledText}>Start monitoring your service now!</div>
        <div>
          <Button size="lg" disabled={isInstallStarted} onClick={onInstall}>
            {isInstallStarted ? 'Installing...' : 'Install'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Steps */}
      <Steps steps={recipe.steps} />
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
