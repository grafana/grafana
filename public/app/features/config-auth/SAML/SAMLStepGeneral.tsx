import { css, cx } from '@emotion/css';
import React from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { HorizontalGroup, Icon, useStyles2 } from '@grafana/ui';
import { StoreState } from 'app/types';

import { loadSettings } from '../state/actions';
import { samlStepChanged } from '../state/reducers';

interface OwnProps {}

export type Props = OwnProps & ConnectedProps<typeof connector>;

function mapStateToProps(state: StoreState) {
  return {
    settings: state.authConfig.settings,
    step: state.authConfig.samlStep,
  };
}

const mapDispatchToProps = {
  loadSettings,
  samlStepChanged,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export const SAMLStepGeneralUnconnected = ({ settings, step, loadSettings, samlStepChanged }: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  const onStepChange = (step: number) => {
    console.log(step);
    samlStepChanged(step);
  };

  return (
    <div className="">
      <h2>General settings</h2>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      display: flex;
      height: ${theme.spacing(6)};
      padding: ${theme.spacing(2)};
      margin: ${theme.spacing(2)} 0;
      border-radius: ${theme.shape.borderRadius(1)};
      border: 1px solid ${theme.colors.border.medium};
    `,
    stepContainer: css`
      cursor: pointer;
      color: ${theme.colors.text.secondary};
    `,
    active: css`
      color: ${theme.colors.text.primary};
    `,
    separator: css`
      color: ${theme.colors.secondary.shade};
      white-space: nowrap;
    `,
    icon: css`
      color: ${theme.colors.success.text};
    `,
  };
};

export const SAMLStepGeneral = connector(SAMLStepGeneralUnconnected);
