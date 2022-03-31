import React, { FC, useCallback, useEffect, useState } from 'react';
import PageWrapper from '../shared/components/PageWrapper/PageWrapper';
import { useStyles2, Spinner } from '@grafana/ui';
import { LIST_ENTITLEMENTS_CANCEL_TOKEN, PAGE_MODEL } from './Entitlements.contants';
import { logger } from '@percona/platform-core';
import { useSelector } from 'react-redux';
import { CollapsableSection } from '@grafana/ui/src/components';
import { useCancelToken } from '../shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from '../shared/helpers/api';
import { getStyles } from './Entitlements.styles';
import EntitlementsService from './Entitlements.service';
import { Entitlement } from './Entitlements.types';
import { SectionContent } from './components/SectionContent/SectionContent';
import { Label } from './components/SectionLabel/SectionLabel';
import { PlatformConnectedLoader } from '../shared/components/Elements/PlatformConnectedLoader';
import { StoreState } from 'app/types';

const EntitlementsPage: FC = () => {
  const [pending, setPending] = useState(true);
  const [data, setData] = useState<Entitlement[]>([]);
  const isConnectedToPortal = useSelector((state: StoreState) => !!state.perconaUser.isPlatformUser);
  const [generateToken] = useCancelToken();
  const styles = useStyles2(getStyles);

  const getData = useCallback(async (showLoading = false) => {
    showLoading && setPending(true);

    try {
      const entitlements = await EntitlementsService.list(generateToken(LIST_ENTITLEMENTS_CANCEL_TOKEN));
      setData(entitlements);
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    setPending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isConnectedToPortal === true) {
      getData(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnectedToPortal]);

  return (
    <PageWrapper pageModel={PAGE_MODEL} dataTestId="page-wrapper-entitlements">
      <PlatformConnectedLoader>
        {pending ? (
          <Spinner className={styles.loader} />
        ) : (
          data.map((entitlement: Entitlement) => {
            const { number, name, endDate } = entitlement;
            return (
              <div key={number} className={styles.collapseWrapper}>
                <CollapsableSection label={<Label name={name} endDate={endDate} />} isOpen={false}>
                  <SectionContent entitlement={entitlement} />
                </CollapsableSection>
              </div>
            );
          })
        )}
      </PlatformConnectedLoader>
    </PageWrapper>
  );
};

export default EntitlementsPage;
