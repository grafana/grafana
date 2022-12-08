import { css } from '@emotion/css';
import React, { ReactElement, useState } from 'react';

import { Button, useStyles2 } from '@grafana/ui';

import { PluginRecipe } from '../types';

import { Steps } from './Steps';

type Props = {
  recipe: PluginRecipe;
  onInstall: () => void;
  isInstalled: boolean;
};

export function DetailsStatus({ recipe, onInstall, isInstalled }: Props): ReactElement {
  const styles = useStyles2(getStyles);
  const [installStarted, setInstallStarted] = useState(false);

  if (!isInstalled) {
    return (
      <div className={styles.notInstalledContainer}>
        <div className={styles.notInstalledText}>Start monitoring your service now!</div>
        <div>
          <Button
            size="lg"
            disabled={installStarted}
            onClick={() => {
              setInstallStarted(true);
              onInstall();
            }}
          >
            {installStarted ? 'Installing...' : 'Install'}
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
