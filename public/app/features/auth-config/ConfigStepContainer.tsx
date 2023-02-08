import { css } from '@emotion/css';
import React, { PropsWithChildren } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import { StoreState } from 'app/types';

import { resetError } from './state/reducers';

interface OwnProps {
  name: string;
  onSave: () => void;
}

export type Props = OwnProps & ConnectedProps<typeof connector>;

function mapStateToProps(state: StoreState) {
  return {
    error: state.authConfig.updateError,
  };
}

const mapDispatchToProps = {
  resetError,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export const ConfigStepContainerUnconnected = ({
  name,
  error,
  onSave,
  children,
  resetError,
}: PropsWithChildren<Props>): JSX.Element => {
  const styles = useStyles2(getStyles);

  const onDismissError = () => {
    resetError();
  };

  return (
    <div>
      <div className={styles.header}>
        <h2>{name}</h2>
        <Button size="sm" fill="outline" onClick={() => onSave()}>
          Save changes
        </Button>
      </div>
      {error && (
        <Alert title={error.message} onRemove={onDismissError}>
          {error.errors?.map((e, i) => (
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
      margin: ${theme.spacing(4)} 0;
    `,
    header: css`
      display: flex;
      justify-content: space-between;
    `,
  };
};

export const ConfigStepContainer = connector(ConfigStepContainerUnconnected);
