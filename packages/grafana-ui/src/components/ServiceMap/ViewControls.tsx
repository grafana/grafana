import React, { useState } from 'react';
import { Button } from '../Button';

interface Props<Config extends Record<string, number>> {
  onScaleChange: (scale: number) => void;
  scale: number;
  config: Config;
  onConfigChange: (config: Config) => void;
  useTestData: boolean;
  onUseTestDataChange: (use: boolean) => void;
}
export function ViewControls<Config extends Record<string, number>>(props: Props<Config>) {
  const { onScaleChange, scale, config, onConfigChange, useTestData, onUseTestDataChange } = props;
  const [showConfig, setShowConfig] = useState(false);

  return (
    <>
      <Button icon={'plus-circle'} onClick={() => onScaleChange(scale * 1.5)} />
      <Button icon={'minus-circle'} onClick={() => onScaleChange(scale / 1.5)} />
      <Button size={'xs'} variant={'link'} onClick={() => setShowConfig(showConfig => !showConfig)}>
        {showConfig ? 'Hide config' : 'Show config'}
      </Button>

      {showConfig && (
        <>
          <div>
            Show test data
            <input
              type={'checkbox'}
              checked={useTestData}
              onChange={e => onUseTestDataChange(e.currentTarget.checked)}
            />
          </div>
          {Object.keys(config).map(k => (
            <div key={k}>
              {k}
              <input
                style={{ width: 50 }}
                type={'number'}
                value={config[k]}
                onChange={e => onConfigChange({ ...config, [k]: parseFloat(e.target.value) })}
              />
            </div>
          ))}
        </>
      )}
    </>
  );
}
