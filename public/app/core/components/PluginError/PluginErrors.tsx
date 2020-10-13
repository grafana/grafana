import React, { PureComponent } from 'react';
import { PluginErrorCode } from '@grafana/data';
import { css } from 'emotion';
import { stylesFactory } from '@grafana/ui';

interface Props {
  errorCodes: PluginErrorCode[];
}

type PluginErrorHelper = {
  [e in PluginErrorCode]: {
    message: () => string;
  };
};

const ErrorDetails: PluginErrorHelper = {
  [PluginErrorCode.unsigned]: {
    message: () => {
      return 'This plugin is unsigned.';
    },
  },
  [PluginErrorCode.modified]: {
    message: () => {
      return 'The plugin signature has been modified.';
    },
  },
  [PluginErrorCode.invalid]: {
    message: () => {
      return 'The plugin signature is invalid.';
    },
  },
};

const getStyles = stylesFactory(() => {
  return {
    button: css`
      margin: 1em 4px 0 0;
    `,
  };
});

export class PluginErrors extends PureComponent<Props> {
  getHelperMessage = (errorCode: PluginErrorCode): string => {
    return ErrorDetails[errorCode].message();
  };
  render() {
    const styles = getStyles();

    const { errorCodes } = this.props;

    return (
      <ul>
        {errorCodes.map((error, i) => {
          return (
            <li key={i} className={styles.button} dangerouslySetInnerHTML={{ __html: this.getHelperMessage(error) }} />
          );
        })}
      </ul>
    );
  }
}
