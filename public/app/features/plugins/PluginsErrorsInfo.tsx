import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { HorizontalGroup, InfoBox, List, PluginSignatureBadge, useTheme } from '@grafana/ui';
import { StoreState } from '../../types';
import { getAllPluginsErrors } from './state/selectors';
import { loadPlugins, loadPluginsErrors } from './state/actions';
import useAsync from 'react-use/lib/useAsync';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { hot } from 'react-hot-loader';
import { PluginError, PluginErrorCode, PluginSignatureStatus } from '@grafana/data';
import { css } from '@emotion/css';

interface ConnectedProps {
  errors: PluginError[];
}

interface DispatchProps {
  loadPluginsErrors: typeof loadPluginsErrors;
}

interface OwnProps {
  children?: React.ReactNode;
}

type PluginsErrorsInfoProps = ConnectedProps & DispatchProps & OwnProps;

export const PluginsErrorsInfoUnconnected: React.FC<PluginsErrorsInfoProps> = ({
  loadPluginsErrors,
  errors,
  children,
}) => {
  const theme = useTheme();

  const { loading } = useAsync(async () => {
    await loadPluginsErrors();
  }, [loadPlugins]);

  if (loading || errors.length === 0) {
    return null;
  }
  return (
    <InfoBox
      aria-label={selectors.pages.PluginsList.signatureErrorNotice}
      severity="warning"
      urlTitle="Read more about plugin signing"
      url="https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/"
    >
      <div>
        <p>
          We have encountered{' '}
          <a
            href="https://grafana.com/docs/grafana/latest/developers/plugins/backend/"
            target="_blank"
            rel="noreferrer"
          >
            data source backend plugins
          </a>{' '}
          that are unsigned. Grafana Labs cannot guarantee the integrity of unsigned plugins and recommends using signed
          plugins only.
        </p>
        The following plugins are disabled and not shown in the list below:
        <List
          items={errors}
          className={css`
            list-style-type: circle;
          `}
          renderItem={(e) => (
            <div
              className={css`
                margin-top: ${theme.spacing.sm};
              `}
            >
              <HorizontalGroup spacing="sm" justify="flex-start" align="center">
                <strong>{e.pluginId}</strong>
                <PluginSignatureBadge
                  status={mapPluginErrorCodeToSignatureStatus(e.errorCode)}
                  className={css`
                    margin-top: 0;
                  `}
                />
              </HorizontalGroup>
            </div>
          )}
        />
        {children}
      </div>
    </InfoBox>
  );
};

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state: StoreState) => {
  return {
    errors: getAllPluginsErrors(state.plugins),
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  loadPluginsErrors,
};

export const PluginsErrorsInfo = hot(module)(
  connect(mapStateToProps, mapDispatchToProps)(PluginsErrorsInfoUnconnected)
);

function mapPluginErrorCodeToSignatureStatus(code: PluginErrorCode) {
  switch (code) {
    case PluginErrorCode.invalidSignature:
      return PluginSignatureStatus.invalid;
    case PluginErrorCode.missingSignature:
      return PluginSignatureStatus.missing;
    case PluginErrorCode.modifiedSignature:
      return PluginSignatureStatus.modified;
    default:
      return PluginSignatureStatus.missing;
  }
}
