import React, { useState } from 'react';
import { Button } from '../Button';
import { stylesFactory, useTheme } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  minusButton: css`
    margin-left: 2px;
  `,

  scale: css`
    font-size: 10px;
    color: ${theme.colors.textFaint};
  `,

  scrollHelp: css`
    font-size: 8px;
    color: ${theme.colors.textFaint};
  `,
}));

interface Props<Config> {
  config: Config;
  onConfigChange: (config: Config) => void;
  onPlus: () => void;
  onMinus: () => void;
  scale: number;
}

/**
 * Control buttons for zoom but also some layout config inputs mainly for debugging.
 */
export function ViewControls<Config extends Record<string, any>>(props: Props<Config>) {
  const { config, onConfigChange, onPlus, onMinus, scale } = props;
  const [showConfig, setShowConfig] = useState(false);
  const styles = getStyles(useTheme());

  // For debugging the layout, should be removed here and maybe moved to panel config later on
  const allowConfiguration = false;

  return (
    <>
      <Button icon={'plus-circle'} onClick={onPlus} size={'sm'} title={'Zoom in'} />
      <Button className={styles.minusButton} icon={'minus-circle'} onClick={onMinus} size={'sm'} title={'Zoom out'} />
      <span className={styles.scale} title={'Zoom level'}>
        {' '}
        {scale.toFixed(2)}x
      </span>
      <div className={styles.scrollHelp}>Or ctrl/meta + scroll</div>
      {allowConfiguration && (
        <Button size={'xs'} variant={'link'} onClick={() => setShowConfig(showConfig => !showConfig)}>
          {showConfig ? 'Hide config' : 'Show config'}
        </Button>
      )}

      {allowConfiguration &&
        showConfig &&
        Object.keys(config)
          .filter(k => k !== 'show')
          .map(k => (
            <div key={k}>
              {k}
              <input
                style={{ width: 50 }}
                type={'number'}
                value={config[k]}
                onChange={e => {
                  onConfigChange({ ...config, [k]: parseFloat(e.target.value) });
                }}
              />
            </div>
          ))}
    </>
  );
}
