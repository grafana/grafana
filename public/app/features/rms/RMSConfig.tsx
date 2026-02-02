import { css } from '@emotion/css';
import React, { FC, memo } from 'react';
import { connect, MapStateToProps } from 'react-redux';

import { NavModel, GrafanaTheme2, AppEvents } from '@grafana/data';
import { Spinner, CallToActionCard, useTheme2, Button } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { t } from 'app/core/internationalization';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';

import { buildHostUrl } from '../dashboard/components/ShareModal/utils';

import Overview from './components/Overview';
import { RMSContextProvider } from './hooks/store';
import { useCustomReducer } from './hooks/useCustomReducer';
import { configState } from './reducers/configuration';

interface ConnectedProps {
  navModel: NavModel;
  uid?: string;
}

const RouteAction = () => {
  const { state } = useCustomReducer();
  const [isLoading, setLoading] = React.useState(false);
  return state.platformURL ? (
    <Button
      icon={`${isLoading ? 'fa fa-spinner' : 'download-alt'}`}
      variant="primary"
      size="md"
      disabled={isLoading}
      onClick={async () => {
        setLoading(true);
        try {
          window.location.href = `${buildHostUrl()}/api/rmsmetadata/studio/download`;
        } catch (error) {
          appEvents.emit(AppEvents.alertError, ['Error', t('bmc.rms.download.error', 'Unable to download')]);
        }
        setLoading(false);
      }}
    >
      {t('bmc.common.download', 'Download')}
    </Button>
  ) : null;
};

export const RMSConfig: FC<ConnectedProps> = memo(({ navModel }) => {
  return (
    <RMSContextProvider initialState={configState}>
      <Page navModel={navModel} actions={<RouteAction />}>
        <Page.Contents isLoading={false}>
          <Config />
        </Page.Contents>
      </Page>
    </RMSContextProvider>
  );
});

RMSConfig.displayName = 'RMSConfig';

interface RMSConfigProps extends GrafanaRouteComponentProps<{}> {}

const mapStateToProps: MapStateToProps<ConnectedProps, RMSConfigProps, StoreState> = (state, props) => {
  return {
    navModel: getNavModel(state.navIndex, 'rms-config'),
  };
};

interface Props {}

const Config: FC<Props> = memo(() => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const { state } = useCustomReducer();

  if (state.initialLoading) {
    return <Spinner className={styles.spinner} />;
  }
  if (state.genErr) {
    return <CallToActionCard message={state.genErr} callToActionElement={<></>} />;
  }
  return <>{renderView()}</>;
});
Config.displayName = 'Config';

const renderView = () => {
  return <Overview />;
};
const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      height: '100%',
    }),
    spinner: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '200px',
    }),
    tabsMargin: css({
      marginBottom: theme.spacing(3),
    }),
  };
};

export default connect(mapStateToProps)(RMSConfig);
