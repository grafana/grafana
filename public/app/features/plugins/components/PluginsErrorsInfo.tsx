import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { HorizontalGroup, InfoBox, List, PluginSignatureBadge, useTheme } from '@grafana/ui';
import { StoreState } from '../../../types';
import { getAllPluginsErrors } from '../state/selectors';
import { loadPlugins, loadPluginsErrors } from '../state/actions';
import useAsync from 'react-use/lib/useAsync';
import { connect, ConnectedProps } from 'react-redux';
import { PluginErrorCode, PluginSignatureStatus } from '@grafana/data';
import { css } from '@emotion/css';

const mapStateToProps = (state: StoreState) => ({
  errors: getAllPluginsErrors(state.plugins),
});

const mapDispatchToProps = {
  loadPluginsErrors,
};

interface OwnProps {
  children?: React.ReactNode;
}
const connector = connect(mapStateToProps, mapDispatchToProps);
type PluginsErrorsInfoProps = ConnectedProps<typeof connector> & OwnProps;

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
          Unsigned plugins were found during plugin initialization. Grafana Labs cannot guarantee the integrity of these
          plugins. We recommend only using signed plugins.
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

export const PluginsErrorsInfo = connect(mapStateToProps, mapDispatchToProps)(PluginsErrorsInfoUnconnected);

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
