import { PureComponent } from 'react';

import { Trans } from 'app/core/internationalization';

import { CanvasElementItem, CanvasElementProps } from '../element';

class NotFoundDisplay extends PureComponent<CanvasElementProps> {
  render() {
    const { config } = this.props;
    return (
      <div>
        <h3>
          <Trans i18nKey="canvas.not-found-display.not-found">NOT FOUND:</Trans>
        </h3>
        <pre>{JSON.stringify(config, null, 2)}</pre>
      </div>
    );
  }
}

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
