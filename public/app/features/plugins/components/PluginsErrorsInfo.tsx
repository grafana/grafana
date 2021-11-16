import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { HorizontalGroup, InfoBox, List, PluginSignatureBadge, useTheme } from '@grafana/ui';
import { useGetErrors, useFetchStatus } from '../admin/state/hooks';
import { PluginErrorCode, PluginSignatureStatus } from '@grafana/data';
import { css } from '@emotion/css';

export const PluginsErrorsInfo: React.FC = ({ children }) => {
  const errors = useGetErrors();
  const { isLoading } = useFetchStatus();
  const theme = useTheme();

  if (isLoading || errors.length === 0) {
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
          renderItem={(error) => (
            <div
              className={css`
                margin-top: ${theme.spacing.sm};
              `}
            >
              <HorizontalGroup spacing="sm" justify="flex-start" align="center">
                <strong>{error.pluginId}</strong>
                <PluginSignatureBadge
                  status={mapPluginErrorCodeToSignatureStatus(error.errorCode)}
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
