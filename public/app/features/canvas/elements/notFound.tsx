import { PureComponent } from 'react';

import { Trans } from '../../../core/internationalization';
import { CanvasElementItem, CanvasElementProps } from '../element';

class NotFoundDisplay extends PureComponent<CanvasElementProps> {
  render() {
    const { config } = this.props;
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
