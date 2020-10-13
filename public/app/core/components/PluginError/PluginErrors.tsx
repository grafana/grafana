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
      return '<span class="fa fa-exclamation-circle"></span> This plugin cannot run as it is not signed';
    },
  },
  [PluginErrorCode.modified]: {
    message: () => {
      return '<span class="fa fa-exclamation-circle"></span> The plugin cannot run as the signature has been modified';
    },
  },
  [PluginErrorCode.invalid]: {
    message: () => {
      return '<span class="fa fa-exclamation-circle"></span> The plugin cannot run as the signature is invalid';
    },
  },
};

const getStyles = stylesFactory(() => {
  return {
    error: css`
      color: #c32121;
      font-weight: bold;
      letter-spacing: 0.05rem;
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
      <div>
        {errorCodes.map((error, i) => {
          return (
            <div key={i} className={styles.error} dangerouslySetInnerHTML={{ __html: this.getHelperMessage(error) }} />
          );
        })}
      </div>
    );
  }
}
