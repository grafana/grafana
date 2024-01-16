import React, { FC, useCallback, useEffect, useState } from 'react';

import { useStyles2 } from '@grafana/ui';
import { CollapsableSection } from '@grafana/ui/src/components';
import { Page } from 'app/core/components/Page/Page';
import { Overlay } from 'app/percona/shared/components/Elements/Overlay';
import { logger } from 'app/percona/shared/helpers/logger';
import { StoreState, useSelector } from 'app/types';

import { PlatformConnectedLoader } from '../shared/components/Elements/PlatformConnectedLoader';
import { PMM_ENTITLEMENTS_PAGE } from '../shared/components/PerconaBootstrapper/PerconaNavigation';
import { useCancelToken } from '../shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from '../shared/helpers/api';

import { LIST_ENTITLEMENTS_CANCEL_TOKEN } from './Entitlements.contants';
import { Messages } from './Entitlements.messages';
import EntitlementsService from './Entitlements.service';
import { getStyles } from './Entitlements.styles';
import { Entitlement } from './Entitlements.types';
import { PageContent } from './components/PageContent/PageContent';
import { SectionContent } from './components/SectionContent/SectionContent';
import { Label } from './components/SectionLabel/SectionLabel';

const EntitlementsPage: FC = () => {
  const [pendingRequest, setPendingRequest] = useState(true);
  const [data, setData] = useState<Entitlement[]>([]);
  const isConnectedToPortal = useSelector((state: StoreState) => !!state.percona.user.isPlatformUser);
  const [generateToken] = useCancelToken();
  const styles = useStyles2(getStyles);

  const getData = useCallback(async (showLoading = false) => {
    showLoading && setPendingRequest(true);

    try {
      const entitlements = await EntitlementsService.list(generateToken(LIST_ENTITLEMENTS_CANCEL_TOKEN));
      setData(entitlements);
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    setPendingRequest(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isConnectedToPortal === true) {
      getData(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnectedToPortal]);

  return (
    <Page
      navModel={{
        main: PMM_ENTITLEMENTS_PAGE,
        node: PMM_ENTITLEMENTS_PAGE,
      }}
    >
      <Page.Contents dataTestId="page-wrapper-entitlements">
        <PlatformConnectedLoader>
          <Overlay dataTestId="entitlements-loading" isPending={pendingRequest}>
            <PageContent hasData={data.length > 0} emptyMessage={Messages.noData} loading={pendingRequest}>
              {data.map((entitlement: Entitlement) => {
                const { number, name, endDate } = entitlement;
                return (
                  <div key={number} className={styles.collapseWrapper}>
                    <CollapsableSection label={<Label name={name} endDate={endDate} />} isOpen={false}>
                      <SectionContent entitlement={entitlement} />
                    </CollapsableSection>
                  </div>
                );
              })}
            </PageContent>
          </Overlay>
        </PlatformConnectedLoader>
      </Page.Contents>
    </Page>
  );
};

export default EntitlementsPage;
