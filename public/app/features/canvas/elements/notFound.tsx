import React, { PureComponent } from 'react';

import { CanvasElementItem, CanvasElementProps } from '../element';

interface NotFoundConfig {
  orig?: any;
}

class NotFoundDisplay extends PureComponent<CanvasElementProps<NotFoundConfig>> {
  render() {
    const { config } = this.props;
    return (
      <div>
        <h3>NOT FOUND:</h3>
        <pre>{JSON.stringify(config, null, 2)}</pre>
      </div>
    );
  }
}

export const notFoundItem: CanvasElementItem<NotFoundConfig> = {
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
