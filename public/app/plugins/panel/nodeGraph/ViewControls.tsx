import { css } from '@emotion/css';
import React, { useState } from 'react';

import { Button, HorizontalGroup, useStyles2, VerticalGroup } from '@grafana/ui';

function getStyles() {
  return {
    wrapper: css`
      label: wrapper;
      pointer-events: all;
    `,
  };
}

interface Props<Config> {
  config: Config;
  onConfigChange: (config: Config) => void;
  onPlus: () => void;
  onMinus: () => void;
  scale: number;
  disableZoomOut?: boolean;
  disableZoomIn?: boolean;
}

/**
 * Control buttons for zoom but also some layout config inputs mainly for debugging.
 */
export function ViewControls<Config extends Record<string, any>>(props: Props<Config>) {
  const { config, onConfigChange, onPlus, onMinus, disableZoomOut, disableZoomIn } = props;
  const [showConfig, setShowConfig] = useState(false);

  // For debugging the layout, should be removed here and maybe moved to panel config later on
  const allowConfiguration = false;
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <VerticalGroup spacing="sm">
        <HorizontalGroup spacing="xs">
          <Button
            icon={'plus-circle'}
            onClick={onPlus}
            size={'md'}
            title={'Zoom in'}
            variant="secondary"
            disabled={disableZoomIn}
          />
          <Button
            icon={'minus-circle'}
            onClick={onMinus}
            size={'md'}
            title={'Zoom out'}
            variant="secondary"
            disabled={disableZoomOut}
          />
        </HorizontalGroup>
        <HorizontalGroup spacing="xs">
          <Button
            icon={'code-branch'}
            onClick={() => onConfigChange({ ...config, gridLayout: false })}
            size={'md'}
            title={'Default layout'}
            variant="secondary"
            disabled={!config.gridLayout}
          />
          <Button
            icon={'apps'}
            onClick={() => onConfigChange({ ...config, gridLayout: true })}
            size={'md'}
            title={'Grid layout'}
            variant="secondary"
            disabled={config.gridLayout}
          />
        </HorizontalGroup>
      </VerticalGroup>

      {allowConfiguration && (
        <Button size={'xs'} fill="text" onClick={() => setShowConfig((showConfig) => !showConfig)}>
          {showConfig ? 'Hide config' : 'Show config'}
        </Button>
      )}

      {allowConfiguration &&
        showConfig &&
        Object.keys(config)
          .filter((k) => k !== 'show')
          .map((k) => (
            <div key={k}>
              {k}
              <input
                style={{ width: 50 }}
                type={'number'}
                value={config[k]}
                onChange={(e) => {
                  onConfigChange({ ...config, [k]: parseFloat(e.target.value) });
                }}
              />
            </div>
          ))}
    </div>
  );
}
