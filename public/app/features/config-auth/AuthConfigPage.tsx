import { css, cx } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2, OrgRole } from '@grafana/data';
import { Alert, ConfirmModal, FilterInput, Icon, LinkButton, RadioButtonGroup, Tooltip, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { StoreState } from 'app/types';

interface OwnProps {}

export type Props = OwnProps & ConnectedProps<typeof connector>;

function mapStateToProps(state: StoreState) {
  return {};
}

const mapDispatchToProps = {};

const connector = connect(mapStateToProps, mapDispatchToProps);

export const AuthConfigPageUnconnected = ({}: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  return (
    <Page navId="authentication">
      <Page.Contents>
        <span>Authentication</span>
        <div className={styles.cardsContainer}></div>
      </Page.Contents>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    cardsContainer: css`
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(288px, 1fr));
      gap: ${theme.spacing(3)};
    `,
  };
};

const AuthConfigPage = connector(AuthConfigPageUnconnected);
export default AuthConfigPage;
