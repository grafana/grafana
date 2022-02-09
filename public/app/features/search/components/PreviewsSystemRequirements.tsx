import { Alert, useStyles2 } from '@grafana/ui';
import React, { FC, useEffect } from 'react';
import { config } from '@grafana/runtime/src';
import { css } from '@emotion/css';
import { useDispatch, useSelector } from 'react-redux';
import { StoreState } from 'app/types';
import { getSystemRequirements } from 'app/features/search/reducers/previews';

export interface Props {
  showPreviews?: boolean;
}

const getText = (requiredImageRendererPluginVersion?: string) => {
  if (requiredImageRendererPluginVersion) {
    return {
      title: 'Image renderer plugin needs to be updated',
      beforeLink: 'You must update the ',
      link: 'Grafana image renderer plugin',
      afterLink: ` to version ${requiredImageRendererPluginVersion} to enable dashboard previews. Please contact your Grafana administrator to update the plugin`,
    };
  }

  return {
    title: 'Image renderer plugin not installed',
    beforeLink: 'You must install the ',
    link: 'Grafana image renderer plugin',
    afterLink: ` to enable dashboard previews. Please contact your Grafana administrator to install the plugin.`,
  };
};

export const PreviewsSystemRequirements: FC<Props> = ({ showPreviews }) => {
  const styles = useStyles2(getStyles);

  const previewsEnabled = config.featureToggles.dashboardPreviews;
  const rendererAvailable = config.rendererAvailable;

  const dispatch = useDispatch();
  const systemRequirementsMet = useSelector((state: StoreState) => state.previews.systemRequirements.met);
  const requiredImageRendererPluginVersion = useSelector(
    (state: StoreState) => state.previews.systemRequirements.requiredImageRendererPluginVersion
  );

  useEffect(() => {
    if (previewsEnabled && rendererAvailable && showPreviews) {
      dispatch(getSystemRequirements());
    }
  }, [dispatch, previewsEnabled, rendererAvailable, showPreviews]);

  if (!previewsEnabled || !showPreviews) {
    return <></>;
  }

  if (rendererAvailable && systemRequirementsMet) {
    return <></>;
  }

  const text = getText(requiredImageRendererPluginVersion);

  return (
    <div className={styles.wrapper}>
      <Alert className={styles.alert} severity="info" title={text.title}>
        <>{text.beforeLink}</>
        <a
          href="https://grafana.com/grafana/plugins/grafana-image-renderer"
          target="_blank"
          rel="noopener noreferrer"
          className="external-link"
        >
          {text.link}
        </a>
        {text.afterLink}
      </Alert>
    </div>
  );
};

const getStyles = () => {
  return {
    wrapper: css`
      display: flex;
      justify-content: center;
    `,
    alert: css`
      max-width: 800px;
    `,
  };
};
