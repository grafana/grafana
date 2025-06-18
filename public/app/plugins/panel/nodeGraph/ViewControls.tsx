import { css } from '@emotion/css';
import { useState } from 'react';

import { t } from '@grafana/i18n';
import { Button, Stack, useStyles2 } from '@grafana/ui';

function getStyles() {
  return {
    wrapper: css({
      label: 'wrapper',
      pointerEvents: 'all',
    }),
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
      <Stack direction="column" gap={1}>
        <Stack gap={0.5}>
          <Button
            icon={'plus-circle'}
            onClick={onPlus}
            size={'md'}
            title={t('nodeGraph.view-controls.title-zoom-in', 'Zoom in')}
            variant="secondary"
            disabled={disableZoomIn}
          />
          <Button
            icon={'minus-circle'}
            onClick={onMinus}
            size={'md'}
            title={t('nodeGraph.view-controls.title-zoom-out', 'Zoom out')}
            variant="secondary"
            disabled={disableZoomOut}
          />
        </Stack>
      </Stack>

      {allowConfiguration && (
        <Button size={'xs'} fill="text" onClick={() => setShowConfig((showConfig) => !showConfig)}>
          {showConfig
            ? t('nodeGraph.view-controls.hide-config', 'Hide config')
            : t('nodeGraph.view-controls.show-config', 'Show config')}
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
