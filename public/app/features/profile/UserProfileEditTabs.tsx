import React, { type ComponentType, Fragment, type ReactElement, useCallback, useMemo } from 'react';

import { type ComponentTypeWithExtensionMeta, type UrlQueryValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Stack, Tab, TabContent, TabsBar } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

const TAB_QUERY_PARAM = 'tab';
const GENERAL_SETTINGS_TAB = 'general';

type Props = {
  children?: React.ReactNode;
  components: ComponentTypeWithExtensionMeta[];
};

export function UserProfileEditTabs(props: Props): ReactElement {
  const { children, components } = props;
  const tabsById = useTabInfoById(components, children);
  const [activeTab, setActiveTab] = useActiveTab(tabsById);
  const showTabs = components.length > 0;

  if (showTabs === false) {
    return <>{children}</>;
  }

  return (
    <div data-testid={selectors.components.UserProfile.extensionPointTabs}>
      <Stack direction="column" gap={2}>
        <TabsBar>
          {Object.values(tabsById).map(({ tabId, title }) => {
            return (
              <Tab
                key={tabId}
                label={title}
                active={activeTab?.tabId === tabId}
                onChangeTab={() => setActiveTab(tabId)}
                data-testid={selectors.components.UserProfile.extensionPointTab(tabId)}
              />
            );
          })}
        </TabsBar>
        <TabContent>
          {Boolean(activeTab) && (
            <Fragment key={activeTab?.tabId}>
              {activeTab?.components.map((Component, index) => <Component key={`${activeTab?.tabId}-${index}`} />)}
            </Fragment>
          )}
        </TabContent>
      </Stack>
    </div>
  );
}

type TabInfo = {
  title: string;
  tabId: string;
  components: ComponentType[];
};

function useTabInfoById(components: Props['components'], general: React.ReactNode): Record<string, TabInfo> {
  return useMemo(() => {
    const tabs: Record<string, TabInfo> = {
      [GENERAL_SETTINGS_TAB]: {
        title: t('user-profile.tabs.general', 'General'),
        tabId: GENERAL_SETTINGS_TAB,
        components: [() => <>{general}</>],
      },
    };

    return components.reduce((acc, component) => {
      const { title } = component.meta;
      const tabId = convertTitleToTabId(title);

      if (!acc[tabId]) {
        acc[tabId] = {
          title,
          tabId,
          components: [],
        };
      }

      acc[tabId].components.push(component);
      return acc;
    }, tabs);
  }, [components, general]);
}

function useActiveTab(tabs: Record<string, TabInfo>): [TabInfo | undefined, (tabId: string) => void] {
  const [queryParams, updateQueryParams] = useQueryParams();
  const activeTabId = convertQueryParamToTabId(queryParams[TAB_QUERY_PARAM]);
  const activeTab = tabs[activeTabId];

  const setActiveTab = useCallback(
    (tabId: string) => updateQueryParams({ [TAB_QUERY_PARAM]: tabId }),
    [updateQueryParams]
  );

  return [activeTab, setActiveTab];
}

function convertQueryParamToTabId(queryParam: UrlQueryValue) {
  if (typeof queryParam !== 'string') {
    return GENERAL_SETTINGS_TAB;
  }
  return convertTitleToTabId(queryParam);
}

function convertTitleToTabId(title: string) {
  return title.toLowerCase();
}
