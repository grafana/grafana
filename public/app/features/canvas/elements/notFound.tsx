import { memo } from 'react';

import { Trans } from '@grafana/i18n';

import { CanvasElementItem, CanvasElementProps } from '../element';

const NotFoundDisplay = memo(({ config }: CanvasElementProps) => {
  return (
    <div>
      <Trans
        i18nKey="canvas.not-found-display.not-found"
        components={{ config: <pre>{JSON.stringify(config, null, 2)}</pre> }}
      >
        <h3>Not found: </h3>
        {'<config />'}
      </Trans>
    </div>
  );
});

NotFoundDisplay.displayName = 'NotFoundDisplay';

export const notFoundItem: CanvasElementItem = {
  id: 'not-found',
  name: 'Not found',
  description: 'Display when element type is not found in the registry',

  display: NotFoundDisplay,

  defaultSize: {
    width: 100,
    height: 100,
  },

  getNewOptions: () => ({
    config: {},
  }),
};
