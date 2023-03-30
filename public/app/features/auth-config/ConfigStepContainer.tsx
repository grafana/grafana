import { css } from '@emotion/css';
import React, { PropsWithChildren } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Badge, useStyles2 } from '@grafana/ui';
import { StoreState } from 'app/types';

import { resetError, resetWarning } from './state/reducers';

interface OwnProps {
  name: string;
  showSavedBadge?: boolean;
  onSave?: () => void;
}

export type Props = OwnProps & ConnectedProps<typeof connector>;

function mapStateToProps(state: StoreState) {
  return {
    error: state.authConfig.updateError,
    warning: state.authConfig.warning,
  };
}

const mapDispatchToProps = {
  resetError,
  resetWarning,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export const ConfigStepContainerUnconnected = ({
  name,
  error,
  warning,
  showSavedBadge,
  children,
  resetError,
  resetWarning,
}: PropsWithChildren<Props>): JSX.Element => {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <div className={styles.header}>
        <h2>{name}</h2>
        <div>{showSavedBadge && <Badge text="Saved" color="green" icon="check" />}</div>
      </div>
      {error && (
        <Alert title={error.message} onRemove={() => resetError()}>
          {error.errors?.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </Alert>
      )}
      {warning && (
        <Alert title={warning.message} onRemove={() => resetWarning()} severity="warning">
          {warning.errors?.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </Alert>
      )}
      <div className={styles.formContent}>{children}</div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    formContent: css`
      margin: ${theme.spacing(2, 0)};
    `,
    header: css`
      display: flex;
      justify-content: space-between;
    `,
  };
};

export const ConfigStepContainer = connector(ConfigStepContainerUnconnected);
