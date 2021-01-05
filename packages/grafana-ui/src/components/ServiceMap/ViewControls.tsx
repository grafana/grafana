import React, { useState } from 'react';
import { Button } from '../Button';

interface Props<Config> {
  config: Config;
  onConfigChange: (config: Config) => void;
  onPlus: () => void;
  onMinus: () => void;
}
export function ViewControls<Config extends Record<string, any>>(props: Props<Config>) {
  const { config, onConfigChange, onPlus, onMinus } = props;
  const [showConfig, setShowConfig] = useState(false);

  return (
    <>
      <Button icon={'plus-circle'} onClick={onPlus} />
      <Button icon={'minus-circle'} onClick={onMinus} />
      <div>Or use ctrl/meta + scroll</div>
      <Button size={'xs'} variant={'link'} onClick={() => setShowConfig(showConfig => !showConfig)}>
        {showConfig ? 'Hide config' : 'Show config'}
      </Button>

      {showConfig &&
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
